using System.Diagnostics;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RebuildSharedData.Networking;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Logging;
using RoRebuildServer.Simulation;
using RoRebuildServer.Simulation.Trading;

namespace RoRebuildServer.Networking.PacketHandlers.Trade;

/// <summary>
/// Everything a player asks of a trade, behind one action byte.
///
/// Every branch checks what it is about to do rather than trusting the client to have
/// greyed out the button: the client decides what to show, and the server decides what is
/// true. A client that asks for something it should not be able to gets a refusal and a
/// reason, not a trade that half works.
/// </summary>
[ClientPacketHandler(PacketType.TradeAction)]
public class PacketTradeAction : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsConnectedAndInGame)
            return;

        Debug.Assert(connection.Player != null);
        Debug.Assert(connection.Character != null);

        var player = connection.Player;
        var action = (TradeAction)msg.ReadByte();

        if (action == TradeAction.Request)
        {
            BeginRequest(player, msg.ReadInt32());
            return;
        }

        var trade = player.Trade;
        if (trade == null)
        {
            //Accepting an invitation that has already gone is the one way to get here in
            //ordinary play - the other player walked off between the offer and the tap - so
            //it is answered rather than logged as somebody misbehaving.
            if (action == TradeAction.Accept || action == TradeAction.Decline)
                CommandBuilder.SendTradeCancelled(player, "That trade is no longer available.");
            return;
        }

        if (!trade.StillValid(out var invalid))
        {
            trade.End(invalid);
            return;
        }

        //Only answering the invitation is possible before it has been answered. Without
        //this the asker could fill the table, lock it, and have the other side open a window
        //onto an offer they never agreed to look at.
        if (!trade.Started && action != TradeAction.Accept && action != TradeAction.Decline
            && action != TradeAction.Cancel)
            return;

        switch (action)
        {
            case TradeAction.Accept:
                //accepting is only meaningful for the side that was asked, and only once:
                //a second accept would re-send the opening packets over a table that already
                //has things on it
                if (trade.Started || trade.B != player)
                    return;
                trade.Started = true;
                CommandBuilder.SendTradeStarted(trade.A, trade.B);
                CommandBuilder.SendTradeStarted(trade.B, trade.A);
                CommandBuilder.SendTradeOffers(trade);
                break;

            case TradeAction.Decline:
            case TradeAction.Cancel:
                trade.End(action == TradeAction.Decline
                    ? $"{player.Name} declined the trade."
                    : $"{player.Name} cancelled the trade.");
                break;

            case TradeAction.AddItem:
                AddItem(player, trade, msg.ReadInt32(), msg.ReadInt32());
                break;

            case TradeAction.RemoveItem:
                if (trade.OfferOf(player).Items.Remove(msg.ReadInt32()))
                {
                    trade.Unlock();
                    CommandBuilder.SendTradeOffers(trade);
                    CommandBuilder.SendTradeLockState(trade);
                }
                break;

            case TradeAction.SetZeny:
                SetZeny(player, trade, msg.ReadInt32());
                break;

            case TradeAction.Lock:
                trade.OfferOf(player).Locked = true;
                CommandBuilder.SendTradeLockState(trade);
                break;

            case TradeAction.Confirm:
                Confirm(player, trade);
                break;

            default:
                ServerLogger.LogWarning($"Player {player} sent trade action {action}, which is "
                                        + "not one this handles.");
                break;
        }
    }

    private static void BeginRequest(Player player, int targetEntityId)
    {
        if (player.Trade != null)
        {
            CommandBuilder.ErrorMessage(player, "You are already trading.");
            return;
        }

        //resolved the way the party invite resolves one, so a target that has just gone is
        //the same kind of nothing here as it is there
        var entity = World.Instance.GetEntityById(targetEntityId);
        if (!entity.TryGet<Player>(out var target) || target.Character.Map == null
                                                  || target.Character.Map != player.Character.Map)
        {
            CommandBuilder.ErrorMessage(player, "That player is no longer here.");
            return;
        }

        if (target == player)
            return;

        if (target.Trade != null)
        {
            CommandBuilder.ErrorMessage(player, $"{target.Name} is already trading.");
            return;
        }

        if (player.Character.Position.DistanceTo(target.Character.Position) > TradeSession.MaxDistance)
        {
            CommandBuilder.ErrorMessage(player, $"{target.Name} is too far away.");
            return;
        }

        //Both sides hold the session from the moment it is asked for, which is what stops a
        //third player asking either of them while the question is still open.
        var trade = new TradeSession(player, target);
        player.Trade = trade;
        target.Trade = trade;

        CommandBuilder.SendTradeRequested(target, player);
    }

    private static void AddItem(Player player, TradeSession trade, int bagId, int count)
    {
        if (count <= 0)
            return;

        var bag = player.Inventory;
        if (bag == null || bag.GetItemCountByBagId(bagId) < count)
        {
            CommandBuilder.ErrorMessage(player, "You do not have that many.");
            return;
        }

        //A cap on how many separate things can be on the table, so a full bag cannot be put
        //down at once and leave the other side with a list they cannot read or a packet
        //nobody sized for.
        var offer = trade.OfferOf(player);
        if (!offer.Items.ContainsKey(bagId) && offer.Items.Count >= MaxOfferedItems)
        {
            CommandBuilder.ErrorMessage(player, $"You can only offer {MaxOfferedItems} kinds of item at once.");
            return;
        }

        offer.Items[bagId] = count;
        trade.Unlock();

        CommandBuilder.SendTradeOffers(trade);
        CommandBuilder.SendTradeLockState(trade);
    }

    private const int MaxOfferedItems = 10;

    private static void SetZeny(Player player, TradeSession trade, int zeny)
    {
        if (zeny < 0)
            zeny = 0;

        if (zeny > player.GetData(PlayerStat.Zeny))
        {
            CommandBuilder.ErrorMessage(player, "You do not have that much zeny.");
            return;
        }

        trade.OfferOf(player).Zeny = zeny;
        trade.Unlock();

        CommandBuilder.SendTradeOffers(trade);
        CommandBuilder.SendTradeLockState(trade);
    }

    private static void Confirm(Player player, TradeSession trade)
    {
        //Confirming before both have agreed is the client getting ahead of itself, not a
        //thing to act on: the whole point of the two steps is that the second one applies to
        //a table both sides have already said yes to.
        if (!trade.BothLocked)
            return;

        trade.OfferOf(player).Confirmed = true;

        if (!trade.BothConfirmed)
        {
            CommandBuilder.SendTradeLockState(trade);
            return;
        }

        if (!trade.TryComplete(out var reason))
        {
            trade.End(reason);
            return;
        }

        CommandBuilder.SendTradeCompleted(trade.A);
        CommandBuilder.SendTradeCompleted(trade.B);

        trade.A.Trade = null;
        trade.B.Trade = null;
    }
}
