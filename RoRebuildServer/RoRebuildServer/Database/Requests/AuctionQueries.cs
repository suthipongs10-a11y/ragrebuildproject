using Microsoft.EntityFrameworkCore;
using RebuildSharedData.Enum;
using RoRebuildServer.Logging;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// The pieces every auction request needs, written once.
///
/// Not requests themselves - they run inside one, on the database thread, against the
/// context it already has. Copying the item out of a listing and into a parcel in
/// particular is the step that must be identical everywhere it happens: three slightly
/// different copies is three chances to drop a refine or a card on the way through.
/// </summary>
public static class AuctionQueries
{
    /// <summary>The listing's item, made into a parcel for whoever is getting it.</summary>
    public static DbInboxParcel ParcelFor(DbAuction auction, Guid recipient,
        ParcelReason reason, int zeny)
    {
        return new DbInboxParcel
        {
            CharacterId = recipient,
            Reason = (byte)reason,
            FromName = reason == ParcelReason.AuctionWon ? auction.SellerName : auction.HighBidderName,
            Zeny = zeny,
            ItemId = auction.ItemId,
            ItemCount = auction.ItemCount,
            IsUnique = auction.IsUnique,
            Refine = auction.Refine,
            ItemFlags = auction.ItemFlags,
            UniqueId = auction.UniqueId,
            Slot0 = auction.Slot0,
            Slot1 = auction.Slot1,
            Slot2 = auction.Slot2,
            Slot3 = auction.Slot3,
            SentAt = DateTime.UtcNow,
        };
    }

    /// <summary>
    /// Everything this character has a stake in: what they listed, and what they are
    /// currently the highest bidder on.
    ///
    /// Both in one answer because they are one page in the window - somebody checking on
    /// an auction wants to know whether they are still winning it in the same glance.
    /// </summary>
    public static async Task SendMine(RoContext dbContext, Guid characterId, string ownerName)
    {
        var rows = await dbContext.Auctions.AsNoTracking()
            .Where(a => !a.IsSettled && (a.SellerId == characterId || a.HighBidderId == characterId))
            .OrderBy(a => a.EndsAt)
            .ToListAsync();

        var player = Inbox.FindOnline(characterId, ownerName);
        if (player == null)
        {
            //Same as the parcel box: the window is waiting for this, so not sending it is
            //worth a line in the log rather than a silent return.
            ServerLogger.LogWarning($"Auction listings for {ownerName} ({characterId}) were "
                                    + "read but they could not be found online to send them to.");
            return;
        }

        CommandBuilder.SendAuctionMine(player, rows, characterId);
    }

    /// <summary>Tells the seller their listing moved, if they are here to be told.</summary>
    public static async Task Announce(RoContext dbContext, DbAuction auction)
    {
        var seller = Inbox.FindOnline(auction.SellerId, auction.SellerName);
        if (seller == null)
            return;

        CommandBuilder.SendServerMessageTo(seller,
            $"มีคนบิด {auction.HighBid:N0} Zeny สำหรับของที่คุณตั้งประมูล");
        await SendMine(dbContext, auction.SellerId, auction.SellerName);
    }

    /// <summary>Tells somebody how much is now waiting in their box.</summary>
    public static async Task Notify(RoContext dbContext, Guid characterId, string? name)
    {
        var player = Inbox.FindOnline(characterId, name);
        if (player == null)
            return;

        var waiting = await dbContext.InboxParcels.CountAsync(p => p.CharacterId == characterId);
        CommandBuilder.SendInboxCount(player, waiting);
        CommandBuilder.SendServerMessageTo(player, "มีของส่งเข้ากล่องพัสดุของคุณ");
    }
}
