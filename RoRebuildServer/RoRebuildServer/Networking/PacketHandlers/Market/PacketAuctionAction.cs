using System.Diagnostics;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Networking.PacketHandlers.Market;

/// <summary>
/// Everything the auction window asks for, behind one packet with an action byte.
///
/// The two that take something from the player - listing and bidding - go through
/// AuctionHouse, which is where the bag and the purse are. The three that only read go
/// straight to the database, since there is nothing to check on this side.
/// </summary>
[ClientPacketHandler(PacketType.AuctionAction)]
public class PacketAuctionAction : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsConnectedAndInGame)
            return;

        Debug.Assert(connection.Player != null);

        var player = connection.Player;
        var action = (AuctionRequestType)msg.ReadByte();

        //No cooldown taken here on purpose. The shared input delay is the one that stops a
        //player clicking or picking things up, and spending it on opening a window would
        //make browsing the market cost them a swing. The guild window, which queries the
        //database the same way, does not take one either.

        switch (action)
        {
            case AuctionRequestType.Browse:
            {
                var search = msg.ReadString();
                var page = msg.ReadByte();
                RoDatabase.EnqueueDbRequest(new AuctionBrowseRequest(player.Id, search, page,
                    AuctionHouse.ResolveSearch(search)));
                break;
            }

            case AuctionRequestType.Mine:
                RoDatabase.EnqueueDbRequest(new AuctionMineRequest(player.Id));
                break;

            case AuctionRequestType.Create:
            {
                var bagId = msg.ReadInt32();
                var count = msg.ReadInt32();
                var price = msg.ReadInt32();
                var hours = msg.ReadByte();
                AuctionHouse.Create(connection, player, bagId, count, price, hours);
                break;
            }

            case AuctionRequestType.Bid:
            {
                var auctionId = msg.ReadInt32();
                var bid = msg.ReadInt32();
                AuctionHouse.Bid(connection, player, auctionId, bid);
                break;
            }

            case AuctionRequestType.Cancel:
                RoDatabase.EnqueueDbRequest(new AuctionCancelRequest(player.Id, msg.ReadInt32()));
                break;
        }
    }
}
