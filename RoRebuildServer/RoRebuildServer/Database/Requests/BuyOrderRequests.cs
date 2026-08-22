using Microsoft.EntityFrameworkCore;
using RebuildSharedData.Enum;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Database.Requests;

/// <summary>The pieces every buy order request needs, written once.</summary>
public static class BuyOrderQueries
{
    /// <summary>The orders this character has standing, newest last.</summary>
    public static async Task SendMine(RoContext dbContext, Guid characterId, string ownerName)
    {
        var rows = await dbContext.BuyOrders.AsNoTracking()
            .Where(o => !o.IsClosed && o.BuyerId == characterId)
            .OrderBy(o => o.EndsAt)
            .ToListAsync();

        var player = Inbox.FindOnline(characterId, ownerName);
        if (player == null)
        {
            ServerLogger.LogWarning($"Buy orders for {ownerName} ({characterId}) were read but "
                                    + "they could not be found online to send them to.");
            return;
        }

        CommandBuilder.SendBuyOrders(player, rows, BuyOrderDataType.MyOrders, 0, rows.Count);
    }

    /// <summary>A stack of something, made into a parcel for whoever is getting it.</summary>
    public static DbInboxParcel ItemParcel(Guid recipient, ParcelReason reason, string? fromName,
        int itemId, int count)
    {
        return new DbInboxParcel
        {
            CharacterId = recipient,
            Reason = (byte)reason,
            FromName = fromName,
            ItemId = itemId,
            ItemCount = count,
            IsUnique = false,
            SentAt = DateTime.UtcNow,
        };
    }
}

/// <summary>
/// Writes a posted order down. The money has already left the buyer's purse, so by the
/// time this runs the row is the only place it is recorded and it has to be written.
/// </summary>
public class BuyOrderCreateRequest : IDbRequest
{
    private readonly DbBuyOrder order;
    private readonly int held;
    private readonly int fee;

    public BuyOrderCreateRequest(DbBuyOrder order, int held, int fee)
    {
        this.order = order;
        this.held = held;
        this.fee = fee;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        //Counted here rather than before the money was taken, because here is the only
        //place the answer is true. The fee comes back with it: this is the server
        //refusing, not the buyer changing their mind.
        var standing = await dbContext.BuyOrders
            .CountAsync(o => o.BuyerId == order.BuyerId && !o.IsClosed);

        if (standing >= MarketConfig.MaxBuyOrdersPerCharacter)
        {
            Inbox.RefundZeny(order.BuyerId, held + fee, ParcelReason.BuyOrderClosed, null);

            var refused = Inbox.FindOnline(order.BuyerId, order.BuyerName);
            if (refused != null)
                CommandBuilder.ErrorMessage(refused.Connection,
                    $"ตั้งรับซื้อได้ไม่เกิน {MarketConfig.MaxBuyOrdersPerCharacter} รายการ คืนเงินแล้ว");
            return;
        }

        dbContext.BuyOrders.Add(order);
        await dbContext.SaveChangesAsync();

        var player = Inbox.FindOnline(order.BuyerId, order.BuyerName);
        if (player == null)
            return;

        CommandBuilder.SendServerMessageTo(player,
            $"ตั้งรับซื้อเรียบร้อย มัดจำ {held:N0} Zeny ค่าธรรมเนียม {fee:N0} Zeny");
        await BuyOrderQueries.SendMine(dbContext, order.BuyerId, order.BuyerName);
    }
}

/// <summary>A page of what people are buying.</summary>
public class BuyOrderBrowseRequest : IDbRequest
{
    private readonly Guid characterId;
    private readonly string viewerName;
    private readonly string search;
    private readonly int page;
    private readonly int[] matchingItemIds;

    public BuyOrderBrowseRequest(Guid characterId, string viewerName, string search, int page,
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
        var query = dbContext.BuyOrders.AsNoTracking()
            .Where(o => !o.IsClosed && o.EndsAt > now && o.RemainingCount > 0);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(o => matchingItemIds.Contains(o.ItemId));

        var total = await query.CountAsync();

        //Best price first: what a seller wants to know is who is paying the most, and any
        //other order makes them read the whole page to find out.
        var rows = await query.OrderByDescending(o => o.PricePer)
            .Skip(page * MarketConfig.BrowsePageSize)
            .Take(MarketConfig.BrowsePageSize)
            .ToListAsync();

        var player = Inbox.FindOnline(characterId, viewerName);
        if (player == null)
        {
            ServerLogger.LogWarning($"The buy order board was read for {viewerName} "
                                    + $"({characterId}) but they could not be found online.");
            return;
        }

        CommandBuilder.SendBuyOrders(player, rows, BuyOrderDataType.Orders, page, total);
    }
}

/// <summary>What this character has standing.</summary>
public class BuyOrderMineRequest : IDbRequest
{
    private readonly Guid characterId;
    private readonly string ownerName;

    public BuyOrderMineRequest(Guid characterId, string ownerName)
    {
        this.characterId = characterId;
        this.ownerName = ownerName;
    }

    public Task ExecuteAsync(RoContext dbContext) =>
        BuyOrderQueries.SendMine(dbContext, characterId, ownerName);
}

/// <summary>
/// Fills an order, as far as it will go.
///
/// The items left the seller's bag before this was queued, so every path out of here ends
/// with them somewhere: on their way to the buyer, or back to the seller. How many the
/// order still wants is decided here and nowhere else, because here is the only place two
/// people selling into it in the same instant become two sales in a row.
/// </summary>
public class BuyOrderSellRequest : IDbRequest
{
    private readonly Guid sellerId;
    private readonly string sellerName;
    private readonly int orderId;
    private readonly int itemId;
    private readonly int count;

    public BuyOrderSellRequest(Guid sellerId, string sellerName, int orderId, int itemId, int count)
    {
        this.sellerId = sellerId;
        this.sellerName = sellerName;
        this.orderId = orderId;
        this.itemId = itemId;
        this.count = count;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var order = await dbContext.BuyOrders.FirstOrDefaultAsync(o => o.Id == orderId);
        var now = DateTime.UtcNow;

        if (order == null || order.IsClosed || order.EndsAt <= now || order.ItemId != itemId)
        {
            GiveBack(dbContext, count, "คำสั่งซื้อนี้ปิดไปแล้ว ของคืนอยู่ในกล่องพัสดุ");
            await dbContext.SaveChangesAsync();
            return;
        }

        if (order.BuyerId == sellerId)
        {
            GiveBack(dbContext, count, "ขายเข้าคำสั่งซื้อของตัวเองไม่ได้");
            await dbContext.SaveChangesAsync();
            return;
        }

        var take = count < order.RemainingCount ? count : order.RemainingCount;
        if (take <= 0)
        {
            GiveBack(dbContext, count, "คำสั่งซื้อนี้เต็มแล้ว ของคืนอยู่ในกล่องพัสดุ");
            await dbContext.SaveChangesAsync();
            return;
        }

        order.RemainingCount -= take;
        if (order.RemainingCount <= 0)
            order.IsClosed = true;

        //The order is written down as filled before anything is paid out, so a failure
        //between the two costs one payout that has to be looked at rather than an order
        //that pays for the same items twice.
        await dbContext.SaveChangesAsync();

        dbContext.InboxParcels.Add(BuyOrderQueries.ItemParcel(order.BuyerId,
            ParcelReason.BuyOrderFilled, sellerName, itemId, take));

        //Anything the order could not take goes straight back rather than being held.
        var leftover = count - take;
        if (leftover > 0)
            GiveBack(dbContext, leftover, null);

        await dbContext.SaveChangesAsync();

        //Paid on the spot, which is the whole point of selling into a standing order - the
        //money has been sitting on the row since it was posted.
        var paid = (int)Math.Min((long)take * order.PricePer, int.MaxValue);
        Inbox.RefundZeny(sellerId, paid, ParcelReason.BuyOrderSold, order.BuyerName);

        var seller = Inbox.FindOnline(sellerId, sellerName);
        if (seller != null)
        {
            var note = leftover > 0
                ? $"ขายได้ {take} ชิ้น ได้ {paid:N0} Zeny · เหลือ {leftover} ชิ้นคืนในกล่องพัสดุ"
                : $"ขายได้ {take} ชิ้น ได้ {paid:N0} Zeny";
            CommandBuilder.SendServerMessageTo(seller, note);
        }

        var buyer = Inbox.FindOnline(order.BuyerId, order.BuyerName);
        if (buyer != null)
        {
            CommandBuilder.SendServerMessageTo(buyer,
                $"{sellerName} ขายของเข้าคำสั่งซื้อของคุณ {take} ชิ้น");
            await BuyOrderQueries.SendMine(dbContext, order.BuyerId, order.BuyerName);
        }
    }

    /// <summary>Puts items back in the seller's box. Queued, not saved, by the caller.</summary>
    private void GiveBack(RoContext dbContext, int howMany, string? why)
    {
        if (howMany <= 0)
            return;

        dbContext.InboxParcels.Add(BuyOrderQueries.ItemParcel(sellerId,
            ParcelReason.BuyOrderClosed, null, itemId, howMany));

        if (why == null)
            return;

        var player = Inbox.FindOnline(sellerId, sellerName);
        if (player != null)
            CommandBuilder.ErrorMessage(player.Connection, why);
    }
}

/// <summary>
/// Takes an order down and gives back what it was still holding.
///
/// Unlike an auction, which cannot be pulled once somebody has bid, this can be cancelled
/// at any point - nobody is mid-way through anything. What has already been bought stays
/// bought; only the unfilled remainder comes back, and the fee does not.
/// </summary>
public class BuyOrderCancelRequest : IDbRequest
{
    private readonly Guid buyerId;
    private readonly string buyerName;
    private readonly int orderId;

    public BuyOrderCancelRequest(Guid buyerId, string buyerName, int orderId)
    {
        this.buyerId = buyerId;
        this.buyerName = buyerName;
        this.orderId = orderId;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var order = await dbContext.BuyOrders.FirstOrDefaultAsync(o => o.Id == orderId);
        var player = Inbox.FindOnline(buyerId, buyerName);

        if (order == null || order.IsClosed || order.BuyerId != buyerId)
        {
            if (player != null)
                CommandBuilder.ErrorMessage(player.Connection, "ไม่พบรายการนี้");
            return;
        }

        var refund = (int)Math.Min((long)order.RemainingCount * order.PricePer, int.MaxValue);
        order.IsClosed = true;
        order.RemainingCount = 0;
        await dbContext.SaveChangesAsync();

        Inbox.RefundZeny(buyerId, refund, ParcelReason.BuyOrderClosed, null);

        //Says what came back rather than only that something did. The items bought before
        //this point are already in the parcel box, so the only thing this closing returns
        //is the deposit nobody sold into.
        if (player != null)
            CommandBuilder.SendServerMessageTo(player,
                $"ปิดคำสั่งซื้อแล้ว คืนมัดจำที่เหลือ {refund:N0} Zeny (ของที่ได้แล้วอยู่ในกล่องพัสดุ)");

        await BuyOrderQueries.SendMine(dbContext, buyerId, buyerName);
    }
}

/// <summary>
/// Closes orders whose week is up and gives back what they were holding.
///
/// On a timer rather than by anybody's action, so money does not sit on a row forever
/// because the person who posted it never logged in again.
/// </summary>
public class BuyOrderExpireRequest : IDbRequest
{
    public async Task ExecuteAsync(RoContext dbContext)
    {
        var now = DateTime.UtcNow;
        var due = await dbContext.BuyOrders
            .Where(o => !o.IsClosed && o.EndsAt <= now)
            .ToListAsync();

        if (due.Count == 0)
            return;

        var owed = new List<(Guid Buyer, string Name, int Amount)>();
        foreach (var order in due)
        {
            owed.Add((order.BuyerId, order.BuyerName,
                (int)Math.Min((long)order.RemainingCount * order.PricePer, int.MaxValue)));
            order.IsClosed = true;
            order.RemainingCount = 0;
        }

        //Closed first, then paid out: a failure between the two is one refund somebody has
        //to chase rather than an order that refunds every time the timer runs.
        await dbContext.SaveChangesAsync();

        foreach (var (buyer, name, amount) in owed)
        {
            if (amount <= 0)
                continue;

            Inbox.RefundZeny(buyer, amount, ParcelReason.BuyOrderClosed, null);

            var player = Inbox.FindOnline(buyer, name);
            if (player != null)
                CommandBuilder.SendServerMessageTo(player,
                    $"คำสั่งซื้อหมดอายุ คืนมัดจำ {amount:N0} Zeny");
        }
    }
}
