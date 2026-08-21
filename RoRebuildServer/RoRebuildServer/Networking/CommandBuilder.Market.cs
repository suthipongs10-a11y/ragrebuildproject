using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
//OutboundMessage lives under RebuildZoneServer despite sitting in this folder
using RebuildZoneServer.Networking;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Networking;

/// <summary>
/// What the market sends down the wire: the parcel box and the auction board.
///
/// Split out of the main file only because that one is long. The reading half of every
/// one of these lives in the client's PacketInboxData and PacketAuctionData, field for
/// field in the same order - a field added to one and not the other turns everything
/// after it into nonsense rather than failing.
/// </summary>
public static partial class CommandBuilder
{
    /// <summary>A line of server text to one player, wherever the caller is running.</summary>
    public static void SendServerMessageTo(Player player, string text)
    {
        if (player.Connection == null)
            return;

        AddRecipient(player.Connection);
        SendServerMessage(text);
        ClearRecipients();
    }

    /// <summary>Just the number, for the badge on the button.</summary>
    public static void SendInboxCount(Player player, int waiting)
    {
        var packet = NetworkManager.StartPacket(PacketType.InboxData);
        packet.Write((byte)InboxDataType.Count);
        packet.Write((short)Math.Clamp(waiting, 0, short.MaxValue));

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>Everything in the box, replacing whatever the window was showing.</summary>
    public static void SendInboxContents(Player player, List<DbInboxParcel> parcels)
    {
        var packet = NetworkManager.StartPacket(PacketType.InboxData);
        packet.Write((byte)InboxDataType.Contents);
        packet.Write((short)parcels.Count);

        foreach (var parcel in parcels)
        {
            packet.Write(parcel.Id);
            packet.Write(parcel.Reason);
            packet.Write(parcel.FromName ?? "");
            packet.Write(parcel.Zeny);
            WriteMarketItem(packet, parcel);
        }

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>One page of the board.</summary>
    public static void SendAuctionListings(Player player, List<DbAuction> rows, int page, int total)
    {
        var packet = NetworkManager.StartPacket(PacketType.AuctionData);
        packet.Write((byte)AuctionDataType.Listings);
        packet.Write((byte)Math.Clamp(page, 0, byte.MaxValue));
        packet.Write(total);
        packet.Write((short)rows.Count);

        foreach (var row in rows)
            WriteAuction(packet, row, false);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>What this character listed and what they are winning, in one page.</summary>
    public static void SendAuctionMine(Player player, List<DbAuction> rows, Guid characterId)
    {
        var packet = NetworkManager.StartPacket(PacketType.AuctionData);
        packet.Write((byte)AuctionDataType.MyListings);
        packet.Write((short)rows.Count);

        foreach (var row in rows)
            WriteAuction(packet, row, row.SellerId == characterId);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>
    /// A page of standing offers to buy, or the ones this character posted.
    ///
    /// One shape for both, unlike the auction pair: the page and the total go out either
    /// way, with the personal list sending page zero and its own length. Two shapes would
    /// be two things to keep in step for no gain.
    /// </summary>
    public static void SendBuyOrders(Player player, List<DbBuyOrder> rows, BuyOrderDataType type,
        int page, int total)
    {
        var packet = NetworkManager.StartPacket(PacketType.BuyOrderData);
        packet.Write((byte)type);
        packet.Write((byte)Math.Clamp(page, 0, byte.MaxValue));
        packet.Write(total);
        packet.Write((short)rows.Count);

        foreach (var row in rows)
        {
            packet.Write(row.Id);
            packet.Write(row.BuyerName);
            packet.Write(row.ItemId);
            packet.Write(row.WantedCount);
            packet.Write(row.RemainingCount);
            packet.Write(row.PricePer);

            //Seconds rather than a moment, for the same reason as an auction: the two
            //machines do not agree on what time it is.
            var left = (row.EndsAt - DateTime.UtcNow).TotalSeconds;
            packet.Write(left <= 0 ? 0 : (int)left);
        }

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>
    /// One listing, seller's view or bidder's view.
    ///
    /// The time left is sent as seconds rather than as a moment, because the two machines
    /// do not agree on what time it is and a countdown that starts three hours out is
    /// worse than no countdown at all.
    /// </summary>
    private static void WriteAuction(OutboundMessage packet, DbAuction row, bool isMine)
    {
        packet.Write(row.Id);
        packet.Write(isMine);
        packet.Write(row.SellerName);
        WriteMarketItem(packet, row);
        packet.Write(row.StartPrice);
        packet.Write(row.HighBid);
        packet.Write(row.HighBidderName ?? "");

        var left = (row.EndsAt - DateTime.UtcNow).TotalSeconds;
        packet.Write(left <= 0 ? 0 : (int)left);
    }

    /// <summary>
    /// The item on a market row.
    ///
    /// The four card slots only go out for a unique item, which is most of the packet for
    /// a page of twenty potions. The client reads them under the same condition, so the
    /// two have to be changed together or neither.
    /// </summary>
    private static void WriteMarketItem(OutboundMessage packet, IDbMarketItem item)
    {
        packet.Write(item.ItemId);
        packet.Write((short)Math.Clamp(item.ItemCount, 0, short.MaxValue));
        packet.Write(item.IsUnique);

        if (!item.IsUnique)
            return;

        packet.Write(item.Refine);
        packet.Write(item.Slot0);
        packet.Write(item.Slot1);
        packet.Write(item.Slot2);
        packet.Write(item.Slot3);
    }
}
