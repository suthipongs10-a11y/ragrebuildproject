using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Simulation.Trading;

/// <summary>An offered item and the slot it has to come out of.</summary>
public readonly struct TradedItem(int bagId, ItemReference item)
{
    public readonly int BagId = bagId;
    public readonly ItemReference Item = item;
}

/// <summary>One side of the table: what this player has put on it.</summary>
public class TradeOffer
{
    /// <summary>Bag id to how many of it. Bag id rather than item id, so two of the same
    /// unique item are two entries and cannot be confused for one stack of two.</summary>
    public readonly Dictionary<int, int> Items = new();

    public int Zeny;

    /// <summary>Whether this side has agreed to what is on the table right now.</summary>
    public bool Locked;

    /// <summary>Whether this side has said the final yes. Only reachable once both are locked.</summary>
    public bool Confirmed;

    public void Clear()
    {
        Items.Clear();
        Zeny = 0;
        Locked = false;
        Confirmed = false;
    }
}

/// <summary>
/// Two players swapping items and money.
///
/// The two steps - lock, then confirm - are the whole design. With one button, one player
/// agrees, the other swaps what they were offering, and agrees in turn; the first has
/// already said yes to something that is no longer on the table. So agreeing locks the
/// offer, changing anything unlocks both, and the swap needs both to have said yes to the
/// same table twice.
///
/// Nothing moves until <see cref="TryComplete"/>, and that checks everything before it
/// touches a single item. A trade that half happens is worse than one that does not.
/// </summary>
public class TradeSession
{
    public readonly Player A;
    public readonly Player B;

    public readonly TradeOffer OfferA = new();
    public readonly TradeOffer OfferB = new();

    /// <summary>How far apart the two may stand. Past this the trade ends rather than
    /// following them around the map.</summary>
    public const int MaxDistance = 12;

    public TradeSession(Player a, Player b)
    {
        A = a;
        B = b;
    }

    public Player Other(Player p) => p == A ? B : A;
    public TradeOffer OfferOf(Player p) => p == A ? OfferA : OfferB;

    public bool Involves(Player p) => p == A || p == B;

    /// <summary>
    /// Either side changing what they are offering takes both locks off.
    ///
    /// Called from every path that alters an offer, rather than from the ones that looked
    /// like they mattered: an offer that changed while somebody had agreed to it is the one
    /// thing this whole design exists to prevent.
    /// </summary>
    public void Unlock()
    {
        OfferA.Locked = false;
        OfferA.Confirmed = false;
        OfferB.Locked = false;
        OfferB.Confirmed = false;
    }

    public bool BothLocked => OfferA.Locked && OfferB.Locked;
    public bool BothConfirmed => OfferA.Confirmed && OfferB.Confirmed;

    /// <summary>
    /// Whether the two are still in a state where a trade makes sense.
    ///
    /// Checked before every step rather than only at the end, so a trade whose other half
    /// walked off or logged out ends when that happens instead of when somebody presses the
    /// last button.
    /// </summary>
    public bool StillValid(out string reason)
    {
        reason = "";

        if (!A.Entity.IsAlive() || !B.Entity.IsAlive())
        {
            reason = "The other player is no longer available.";
            return false;
        }

        if (A.Character.Map == null || B.Character.Map == null || A.Character.Map != B.Character.Map)
        {
            reason = "The other player has left the area.";
            return false;
        }

        if (A.Character.Position.DistanceTo(B.Character.Position) > MaxDistance)
        {
            reason = "You are too far apart to trade.";
            return false;
        }

        return true;
    }

    /// <summary>
    /// Moves everything across, or nothing.
    ///
    /// Every check happens before the first item is taken out of anyone's bag. The order is
    /// deliberate: what is on offer still has to be there, both sides have to have room for
    /// what is coming, and both have to be able to hold the money. Only then does anything
    /// move, and from that line to the end there is no way out - because the way out is what
    /// would leave one player's sword gone and the other's money still their own.
    /// </summary>
    public bool TryComplete(out string reason)
    {
        if (!StillValid(out reason))
            return false;

        if (!BothLocked || !BothConfirmed)
        {
            reason = "Both players have to agree first.";
            return false;
        }

        //--- gather what is being handed over, and check it is all still there ------
        if (!Collect(A, OfferA, out var fromA, out reason))
            return false;
        if (!Collect(B, OfferB, out var fromB, out reason))
            return false;

        //--- and that the other side can take it ------------------------------------
        if (!HasRoom(B, fromA, OfferA.Zeny, out reason))
            return false;
        if (!HasRoom(A, fromB, OfferB.Zeny, out reason))
            return false;

        //--- nothing below here may fail --------------------------------------------
        Hand(A, B, fromA, OfferA.Zeny);
        Hand(B, A, fromB, OfferB.Zeny);

        CommandBuilder.SendUpdatePlayerData(A, true, false, A.HasCart);
        CommandBuilder.SendUpdatePlayerData(B, true, false, B.HasCart);

        return true;
    }

    /// <summary>
    /// Takes an offer apart into the items it actually names, refusing if any of it has
    /// gone. An offer is a list of bag ids and the bag they point into can change under
    /// it - things get sold, dropped, used - so what was promised is checked, not assumed.
    /// </summary>
    private static bool Collect(Player from, TradeOffer offer, out List<TradedItem> items, out string reason)
    {
        items = new List<TradedItem>();
        reason = "";

        if (offer.Zeny < 0 || offer.Zeny > from.GetData(PlayerStat.Zeny))
        {
            reason = $"{from.Name} no longer has that much zeny.";
            return false;
        }

        var bag = from.Inventory;
        if (bag == null)
            return offer.Items.Count == 0;

        foreach (var (bagId, count) in offer.Items)
        {
            if (count <= 0 || bag.GetItemCountByBagId(bagId) < count)
            {
                reason = $"{from.Name} no longer has one of the offered items.";
                return false;
            }

            if (!bag.GetItem(bagId, out var item))
            {
                reason = $"{from.Name} no longer has one of the offered items.";
                return false;
            }

            item.Count = count;
            //the slot travels with the item. Removing wants the slot, and looking one back up
            //from the item would pick the wrong one whenever two slots hold the same thing.
            items.Add(new TradedItem(bagId, item));
        }

        return true;
    }

    private static bool HasRoom(Player to, List<TradedItem> incoming, int zeny, out string reason)
    {
        reason = "";

        //int is what zeny is stored in, and a trade that would push somebody past it would
        //silently clamp - which is money quietly destroyed rather than moved
        if (int.MaxValue - zeny < to.GetData(PlayerStat.Zeny))
        {
            reason = $"{to.Name} cannot carry that much zeny.";
            return false;
        }

        foreach (var entry in incoming)
        {
            if (to.CanPickUpItem(entry.Item))
                continue;

            reason = $"{to.Name} cannot carry any more.";
            return false;
        }

        return true;
    }

    private static void Hand(Player from, Player to, List<TradedItem> items, int zeny)
    {
        foreach (var entry in items)
        {
            if (from.Inventory == null || !from.Inventory.RemoveItemByBagIdAndGetRemovedItem(
                    entry.BagId, entry.Item.Count, out var removed))
            {
                //Checked already in Collect, so reaching here means the bag changed between
                //the check and now. Logged rather than thrown: there is nothing sensible to
                //unwind to at this point, and a warning that names both players is what makes
                //it findable if it ever happens.
                ServerLogger.LogWarning($"Trade between {from.Name} and {to.Name}: bag slot "
                                        + $"{entry.BagId} vanished between being checked and "
                                        + "being handed over.");
                continue;
            }

            to.AddItemToInventory(removed);
        }

        if (zeny <= 0)
            return;

        from.DropZeny(zeny);
        to.AddZeny(zeny);
    }

    /// <summary>Ends it for both, tells both, and leaves neither holding a dead session.</summary>
    public void End(string reason)
    {
        CommandBuilder.SendTradeCancelled(A, reason);
        CommandBuilder.SendTradeCancelled(B, reason);

        A.Trade = null;
        B.Trade = null;
    }
}
