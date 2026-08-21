using System.Diagnostics;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Networking.PacketHandlers.Market;

/// <summary>
/// Everything the buy order page asks for, behind one packet with an action byte.
///
/// The two that take something from the player - posting an order and selling into one -
/// go through BuyOrders, which is where the bag and the purse are. The three that only
/// read go straight to the database.
/// </summary>
[ClientPacketHandler(PacketType.BuyOrderAction)]
public class PacketBuyOrderAction : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsConnectedAndInGame)
            return;

        Debug.Assert(connection.Player != null);

        var player = connection.Player;
        var action = (BuyOrderRequestType)msg.ReadByte();

        if (player.Inventory == null)
            return; //still loading; there is no bag to take anything out of yet

        switch (action)
        {
            case BuyOrderRequestType.Browse:
            {
                var search = msg.ReadString();
                var page = msg.ReadByte();
                RoDatabase.EnqueueDbRequest(new BuyOrderBrowseRequest(player.Id, player.Name,
                    search, page, AuctionHouse.ResolveSearch(search)));
                break;
            }

            case BuyOrderRequestType.Mine:
                RoDatabase.EnqueueDbRequest(new BuyOrderMineRequest(player.Id, player.Name));
                break;

            case BuyOrderRequestType.Create:
            {
                var itemId = msg.ReadInt32();
                var count = msg.ReadInt32();
                var pricePer = msg.ReadInt32();
                BuyOrders.Create(connection, player, itemId, count, pricePer);
                break;
            }

            case BuyOrderRequestType.Sell:
            {
                var orderId = msg.ReadInt32();
                var bagId = msg.ReadInt32();
                var count = msg.ReadInt32();
                BuyOrders.Sell(connection, player, orderId, bagId, count);
                break;
            }

            case BuyOrderRequestType.Cancel:
                RoDatabase.EnqueueDbRequest(new BuyOrderCancelRequest(player.Id, player.Name,
                    msg.ReadInt32()));
                break;
        }
    }
}
