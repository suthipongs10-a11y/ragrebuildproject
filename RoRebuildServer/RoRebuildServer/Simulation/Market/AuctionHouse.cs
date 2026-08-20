using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Simulation.Market;

/// <summary>
/// The half of the auction house that runs where the bags and the purses are.
///
/// Split from the database requests on purpose, and the split is always the same: this
/// side owns what the player has, so it is the only place an item may leave a bag or
/// money may leave a purse; the other side owns the listings, so it is the only place a
/// bid may be compared against another. Neither can do the other's job safely, because
/// they run on different threads.
///
/// The consequence to keep in mind when reading either: by the time a request reaches the
/// database, the item and the money are already gone from the player. Every path through
/// the request must therefore end in the listing, in somebody's parcel box, or back in the
/// player's hands - never in nothing.
/// </summary>
public static class AuctionHouse
{
    private static float nextSettleCheck;

    /// <summary>
    /// Looks for listings that have run out, every so often.
    ///
    /// Called from the world's own update rather than from a timer of its own, so it can
    /// only run between ticks and never in the middle of one.
    /// </summary>
    public static void Update()
    {
        if (Time.ElapsedTime < nextSettleCheck)
            return;

        nextSettleCheck = (float)Time.ElapsedTime + MarketConfig.SettleIntervalSeconds;
        RoDatabase.EnqueueDbRequest(new AuctionSettleRequest());
    }

    /// <summary>
    /// Puts something up for auction: takes the item, takes the fee, queues the listing.
    ///
    /// Everything that can be refused is refused before anything is taken, the same way a
    /// donation is - so a listing that does not happen costs nothing.
    /// </summary>
    public static void Create(NetworkConnection connection, Player player, int bagId, int count,
        int startPrice, int hours)
    {
        var bag = player.Inventory;
        if (bag == null)
            return;

        if (startPrice < MarketConfig.MinimumPrice || startPrice > MarketConfig.MaximumPrice)
        {
            CommandBuilder.ErrorMessage(connection,
                $"ราคาต้องอยู่ระหว่าง {MarketConfig.MinimumPrice:N0} ถึง {MarketConfig.MaximumPrice:N0} Zeny");
            return;
        }

        if (Array.IndexOf(MarketConfig.DurationChoices, hours) < 0)
        {
            CommandBuilder.ErrorMessage(connection, "ระยะเวลาไม่ถูกต้อง");
            return;
        }

        if (count <= 0 || !bag.GetItem(bagId, out var item) || bag.GetItemCountByBagId(bagId) < count)
        {
            CommandBuilder.ErrorMessage(connection, "ของไม่พอ");
            return;
        }

        if (player.Equipment != null && player.Equipment.IsItemEquipped(bagId))
        {
            CommandBuilder.ErrorMessage(connection, "ของที่ใส่อยู่ตั้งขายไม่ได้");
            return;
        }

        var fee = MarketConfig.ListingFee(startPrice);
        if (player.GetZeny() < fee)
        {
            CommandBuilder.ErrorMessage(connection, $"ต้องมีค่าฝาก {fee:N0} Zeny");
            return;
        }

        //--- nothing below here may fail -----------------------------------------
        if (!bag.RemoveItemByBagIdAndGetRemovedItem(bagId, count, out var removed))
        {
            CommandBuilder.ErrorMessage(connection, "ของไม่พอ");
            return;
        }

        player.DropZeny(fee); //tells the client on its own way out

        var auction = new DbAuction
        {
            SellerId = player.Id,
            SellerName = player.Name,
            StartPrice = startPrice,
            HighBid = 0,
            HighBidderId = Guid.Empty,
            ListedAt = DateTime.UtcNow,
            EndsAt = DateTime.UtcNow.AddHours(hours),
        };
        auction.StoreItem(removed);

        RoDatabase.EnqueueDbRequest(new AuctionCreateRequest(auction));
    }

    /// <summary>
    /// Takes the money for a bid and sends it to be compared with the standing one.
    ///
    /// The money goes now, not when the bid is accepted. A bid that is only checked
    /// against a purse is a bid somebody can make on five listings with one purse's worth
    /// of zeny and then win all five.
    /// </summary>
    public static void Bid(NetworkConnection connection, Player player, int auctionId, int bid)
    {
        if (bid < MarketConfig.MinimumPrice || bid > MarketConfig.MaximumPrice)
        {
            CommandBuilder.ErrorMessage(connection, "จำนวนเงินไม่ถูกต้อง");
            return;
        }

        if (player.GetZeny() < bid)
        {
            CommandBuilder.ErrorMessage(connection, "Zeny ไม่พอ");
            return;
        }

        player.DropZeny(bid);

        RoDatabase.EnqueueDbRequest(new AuctionBidRequest(player.Id, player.Name, auctionId, bid));
    }

    /// <summary>
    /// The item numbers whose names contain what was typed.
    ///
    /// Worked out here because the names live in the loaded game data - the listing row
    /// only knows an item's number, so the database has no way to search by name at all.
    /// Capped, because a single letter would otherwise match most of the item table and
    /// put all of it into one query.
    /// </summary>
    public static int[] ResolveSearch(string search)
    {
        if (string.IsNullOrWhiteSpace(search))
            return Array.Empty<int>();

        var needle = search.Trim();
        var matches = new List<int>();

        foreach (var (id, info) in DataManager.ItemList)
        {
            if (info.Name != null && info.Name.Contains(needle, StringComparison.OrdinalIgnoreCase))
                matches.Add(id);
            else if (info.Code != null && info.Code.Contains(needle, StringComparison.OrdinalIgnoreCase))
                matches.Add(id);

            if (matches.Count >= 500)
                break;
        }

        return matches.ToArray();
    }
}
