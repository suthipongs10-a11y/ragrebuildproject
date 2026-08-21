using Microsoft.EntityFrameworkCore;
using RebuildSharedData.Enum;
using RoRebuildServer.Logging;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// Puts a listing up. The item has already left the seller's bag and the fee has already
/// been taken, on the game thread, before this was queued - so by the time this runs the
/// row is the only place that item exists and it has to be written.
/// </summary>
public class AuctionCreateRequest : IDbRequest
{
    private readonly DbAuction auction;

    public AuctionCreateRequest(DbAuction auction) => this.auction = auction;

    public async Task ExecuteAsync(RoContext dbContext)
    {
        //Counted here rather than before the item was taken, because here is the only
        //place the answer is true - the game thread has no idea how many rows this
        //character has. The fee comes back too: this is the server refusing, not the
        //player changing their mind.
        var running = await dbContext.Auctions
            .CountAsync(a => a.SellerId == auction.SellerId && !a.IsSettled);

        if (running >= MarketConfig.MaxListingsPerCharacter)
        {
            dbContext.InboxParcels.Add(AuctionQueries.ParcelFor(auction, auction.SellerId,
                ParcelReason.AuctionCancelled, MarketConfig.ListingFee(auction.StartPrice)));
            await dbContext.SaveChangesAsync();

            var refused = Inbox.FindOnline(auction.SellerId, auction.SellerName);
            if (refused != null)
                CommandBuilder.ErrorMessage(refused.Connection,
                    $"ตั้งประมูลได้ไม่เกิน {MarketConfig.MaxListingsPerCharacter} รายการ ของคืนอยู่ในกล่องพัสดุ");
            return;
        }

        dbContext.Auctions.Add(auction);
        await dbContext.SaveChangesAsync();

        var player = Inbox.FindOnline(auction.SellerId, auction.SellerName);
        if (player == null)
            return;

        CommandBuilder.SendServerMessageTo(player, "ตั้งประมูลเรียบร้อยแล้ว");
        await AuctionQueries.SendMine(dbContext, auction.SellerId, auction.SellerName);
    }
}

/// <summary>A page of what is up for auction, filtered by whatever was typed in the box.</summary>
public class AuctionBrowseRequest : IDbRequest
{
    private readonly Guid characterId;
    private readonly string viewerName;
    private readonly string search;
    private readonly int page;
    private readonly int[] matchingItemIds;

    /// <summary>
    /// The search is resolved to item ids by the caller, on the game thread, because the
    /// item names live in the loaded game data and not in the database - the auction row
    /// only knows an item's number.
    /// </summary>
    public AuctionBrowseRequest(Guid characterId, string viewerName, string search, int page,
        int[] matchingItemIds)
    {
        this.characterId = characterId;
        this.viewerName = viewerName;
        this.search = search;
        this.page = page < 0 ? 0 : page;
        this.matchingItemIds = matchingItemIds;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var now = DateTime.UtcNow;
        var query = dbContext.Auctions.AsNoTracking()
            .Where(a => !a.IsSettled && a.EndsAt > now);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(a => matchingItemIds.Contains(a.ItemId));

        var total = await query.CountAsync();
        var rows = await query.OrderBy(a => a.EndsAt)
            .Skip(page * MarketConfig.BrowsePageSize)
            .Take(MarketConfig.BrowsePageSize)
            .ToListAsync();

        var player = Inbox.FindOnline(characterId, viewerName);
        if (player == null)
        {
            ServerLogger.LogWarning($"The auction board was read for {viewerName} ({characterId}) "
                                    + "but they could not be found online to send it to.");
            return;
        }

        CommandBuilder.SendAuctionListings(player, rows, page, total);
    }
}

/// <summary>What this character has listed, and what they are currently winning or losing.</summary>
public class AuctionMineRequest : IDbRequest
{
    private readonly Guid characterId;
    private readonly string ownerName;

    public AuctionMineRequest(Guid characterId, string ownerName)
    {
        this.characterId = characterId;
        this.ownerName = ownerName;
    }

    public Task ExecuteAsync(RoContext dbContext) =>
        AuctionQueries.SendMine(dbContext, characterId, ownerName);
}

/// <summary>
/// Takes a bid, or gives it straight back.
///
/// The money left the bidder's purse on the game thread before this was queued, which is
/// the only way to know the bid is one they can actually pay. Every path out of here
/// therefore either takes the money onto the row or refunds it - there is no third option,
/// because the third option is money that stopped existing.
///
/// The comparison happens here rather than on the game thread because here is the only
/// place it is safe: database requests run one at a time, so two people bidding in the
/// same instant are two bids in a row rather than two bids at once.
/// </summary>
public class AuctionBidRequest : IDbRequest
{
    private readonly Guid bidderId;
    private readonly string bidderName;
    private readonly int auctionId;
    private readonly int bid;

    public AuctionBidRequest(Guid bidderId, string bidderName, int auctionId, int bid)
    {
        this.bidderId = bidderId;
        this.bidderName = bidderName;
        this.auctionId = auctionId;
        this.bid = bid;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var auction = await dbContext.Auctions.FirstOrDefaultAsync(a => a.Id == auctionId);

        if (auction == null || auction.IsSettled || auction.EndsAt <= DateTime.UtcNow)
        {
            GiveBack("การประมูลนี้จบไปแล้ว");
            return;
        }

        if (auction.SellerId == bidderId)
        {
            GiveBack("บิดของตัวเองไม่ได้");
            return;
        }

        var minimum = MarketConfig.MinimumBid(auction.StartPrice, auction.HighBid);
        if (bid < minimum)
        {
            GiveBack($"ต้องบิดอย่างน้อย {minimum:N0} Zeny");
            return;
        }

        //The one they are pushing out gets theirs back before the row is overwritten, so
        //there is no moment where two people's money is on the same listing.
        if (auction.HighBidderId != Guid.Empty && auction.HighBid > 0)
            Inbox.RefundZeny(auction.HighBidderId, auction.HighBid,
                ParcelReason.AuctionOutbid, auction.SellerName);

        auction.HighBid = bid;
        auction.HighBidderId = bidderId;
        auction.HighBidderName = bidderName;

        //Kept after it is beaten. The listing only ever holds the bid that is winning,
        //because that is the only one the money is on; this is so somebody looking at it
        //can tell a thing being fought over from one that has sat untouched all day.
        dbContext.AuctionBids.Add(new DbAuctionBid
        {
            AuctionId = auction.Id,
            BidderId = bidderId,
            BidderName = bidderName,
            Amount = bid,
            PlacedAt = DateTime.UtcNow,
        });

        await dbContext.SaveChangesAsync();

        var player = Inbox.FindOnline(bidderId, bidderName);
        if (player != null)
        {
            CommandBuilder.SendServerMessageTo(player, $"บิด {bid:N0} Zeny เรียบร้อย");

            //Sent unasked, because whoever just bid is almost certainly looking at the very
            //list this belongs on. Waiting for the next refresh to show their own bid reads
            //as the bid not having landed.
            await AuctionQueries.SendHistory(dbContext, bidderId, bidderName, auction.Id);
        }

        await AuctionQueries.Announce(dbContext, auction);
    }

    private void GiveBack(string why)
    {
        Inbox.RefundZeny(bidderId, bid, ParcelReason.AuctionOutbid, null);

        var player = Inbox.FindOnline(bidderId, bidderName);
        if (player != null)
            CommandBuilder.ErrorMessage(player.Connection, why);
    }
}

/// <summary>Who has bid on one listing, newest first.</summary>
public class AuctionHistoryRequest : IDbRequest
{
    private readonly Guid viewerId;
    private readonly string viewerName;
    private readonly int auctionId;

    public AuctionHistoryRequest(Guid viewerId, string viewerName, int auctionId)
    {
        this.viewerId = viewerId;
        this.viewerName = viewerName;
        this.auctionId = auctionId;
    }

    public async Task ExecuteAsync(RoContext dbContext) =>
        await AuctionQueries.SendHistory(dbContext, viewerId, viewerName, auctionId);
}

/// <summary>
/// Takes a listing down, but only one nobody has bid on.
///
/// A seller who could cancel after a bid could watch the bidding and pull anything that
/// was not going well, which makes every bid a bid on whether the seller likes the price.
/// </summary>
public class AuctionCancelRequest : IDbRequest
{
    private readonly Guid sellerId;
    private readonly string sellerName;
    private readonly int auctionId;

    public AuctionCancelRequest(Guid sellerId, string sellerName, int auctionId)
    {
        this.sellerId = sellerId;
        this.sellerName = sellerName;
        this.auctionId = auctionId;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var auction = await dbContext.Auctions.FirstOrDefaultAsync(a => a.Id == auctionId);
        var player = Inbox.FindOnline(sellerId, sellerName);

        if (auction == null || auction.IsSettled || auction.SellerId != sellerId)
        {
            if (player != null)
                CommandBuilder.ErrorMessage(player.Connection, "ไม่พบรายการนี้");
            return;
        }

        if (auction.HighBid > 0)
        {
            if (player != null)
                CommandBuilder.ErrorMessage(player.Connection, "มีคนบิดแล้ว ยกเลิกไม่ได้");
            return;
        }

        auction.IsSettled = true;
        await dbContext.SaveChangesAsync();

        //Settled first, then the item is written back. The other order would mean a crash
        //between the two leaves the item both in a parcel and still up for auction.
        dbContext.InboxParcels.Add(AuctionQueries.ParcelFor(auction, sellerId,
            ParcelReason.AuctionCancelled, 0));
        await dbContext.SaveChangesAsync();

        if (player != null)
            CommandBuilder.SendServerMessageTo(player, "ยกเลิกรายการแล้ว ของอยู่ในกล่องพัสดุ");

        await AuctionQueries.SendMine(dbContext, sellerId, sellerName);
    }
}

/// <summary>
/// Pays out everything whose time is up.
///
/// Run on a timer rather than by anybody's action, so an auction ends whether or not the
/// people involved are logged in - which is the entire point of the parcel box existing.
/// </summary>
public class AuctionSettleRequest : IDbRequest
{
    public async Task ExecuteAsync(RoContext dbContext)
    {
        var now = DateTime.UtcNow;
        var due = await dbContext.Auctions
            .Where(a => !a.IsSettled && a.EndsAt <= now)
            .ToListAsync();

        if (due.Count == 0)
            return;

        foreach (var auction in due)
            auction.IsSettled = true;

        //Marked before the parcels are written, on purpose. If this falls over between the
        //two, the worst case is a listing that pays nobody and has to be looked at by hand;
        //the other order's worst case is a listing that pays out twice.
        await dbContext.SaveChangesAsync();

        foreach (var auction in due)
        {
            if (auction.HighBid > 0 && auction.HighBidderId != Guid.Empty)
            {
                dbContext.InboxParcels.Add(AuctionQueries.ParcelFor(auction, auction.HighBidderId,
                    ParcelReason.AuctionWon, 0));

                var proceeds = MarketConfig.SellerProceeds(auction.HighBid);
                dbContext.InboxParcels.Add(new DbInboxParcel
                {
                    CharacterId = auction.SellerId,
                    Reason = (byte)ParcelReason.AuctionSold,
                    FromName = auction.HighBidderName,
                    Zeny = proceeds,
                    SentAt = now,
                });
            }
            else
                dbContext.InboxParcels.Add(AuctionQueries.ParcelFor(auction, auction.SellerId,
                    ParcelReason.AuctionExpired, 0));
        }

        await dbContext.SaveChangesAsync();

        foreach (var auction in due)
        {
            await AuctionQueries.Notify(dbContext, auction.SellerId, auction.SellerName);
            if (auction.HighBidderId != Guid.Empty)
                await AuctionQueries.Notify(dbContext, auction.HighBidderId, auction.HighBidderName);
        }
    }
}
