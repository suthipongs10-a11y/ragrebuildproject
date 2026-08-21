using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Simulation.Market;

/// <summary>
/// The half of the buy orders that runs where the bags and the purses are.
///
/// Same split as the auction house, for the same reason: this side owns what a player
/// has, so it is the only place money may leave a purse or items may leave a bag; the
/// database side owns the orders, so it is the only place two people selling into the
/// same order at once can be told apart. They run on different threads.
///
/// What that means when reading either half: by the time a request runs, the money or the
/// items are already gone from the player. Every path through it has to end with them on
/// the order, in somebody's parcel box, or back where they came from.
/// </summary>
public static class BuyOrders
{
    private static float nextExpiryCheck;

    /// <summary>Looks for orders that have run out, on the same cadence as the auctions.</summary>
    public static void Update()
    {
        if (Time.ElapsedTime < nextExpiryCheck)
            return;

        nextExpiryCheck = (float)Time.ElapsedTime + MarketConfig.SettleIntervalSeconds;
        RoDatabase.EnqueueDbRequest(new BuyOrderExpireRequest());
    }

    /// <summary>
    /// Whether this is a thing an order can be posted for.
    ///
    /// Only stackable items. An order names a thing by its number, and a +7 sword with two
    /// cards in it is a different thing from a +0 one that shares that number - somebody
    /// would post an order meaning one and be filled with the other. Gear is left to the
    /// auction house, where what is being bought can be looked at first.
    /// </summary>
    public static bool CanBeOrdered(int itemId, out string refusal)
    {
        refusal = "";

        var info = DataManager.GetItemInfoById(itemId);
        if (info == null)
        {
            refusal = "ไม่มีของชิ้นนี้";
            return false;
        }

        if (info.IsUnique)
        {
            refusal = "อาวุธกับชุดเกราะตั้งรับซื้อไม่ได้ ใช้ประมูลแทน";
            return false;
        }

        return true;
    }

    /// <summary>
    /// Posts an order: takes the whole total and the fee, then queues the row.
    ///
    /// The money goes now rather than when somebody sells into it. An order that is only
    /// checked against a purse is one somebody can post five of with a single purse's
    /// worth of zeny, and the seller who turns up to fill the fifth is the one who finds
    /// out - after handing over their items.
    /// </summary>
    public static void Create(NetworkConnection connection, Player player, int itemId, int count,
        int pricePer)
    {
        if (!CanBeOrdered(itemId, out var refusal))
        {
            CommandBuilder.ErrorMessage(connection, refusal);
            return;
        }

        if (!MarketConfig.TryBuyOrderCost(pricePer, count, out var held, out var fee))
        {
            CommandBuilder.ErrorMessage(connection,
                $"จำนวนหรือราคาไม่ถูกต้อง (ไม่เกิน {MarketConfig.MaxBuyOrderCount:N0} ชิ้น "
                + $"ราคาอย่างน้อย {MarketConfig.MinimumPrice} Zeny)");
            return;
        }

        var cost = held + fee;
        if (player.GetZeny() < cost)
        {
            CommandBuilder.ErrorMessage(connection,
                $"ต้องมี {cost:N0} Zeny (มัดจำ {held:N0} + ค่าธรรมเนียม {fee:N0})");
            return;
        }

        //--- nothing below here may fail -----------------------------------------
        player.DropZeny(cost);

        var order = new DbBuyOrder
        {
            BuyerId = player.Id,
            BuyerName = player.Name,
            ItemId = itemId,
            WantedCount = count,
            RemainingCount = count,
            PricePer = pricePer,
            PostedAt = DateTime.UtcNow,
            EndsAt = DateTime.UtcNow.AddDays(MarketConfig.BuyOrderDurationDays),
        };

        RoDatabase.EnqueueDbRequest(new BuyOrderCreateRequest(order, held, fee));
    }

    /// <summary>
    /// Sells into an order: takes the items, then queues the payout.
    ///
    /// How many the order still wants is not known here - somebody else may be selling
    /// into it in the same second - so what leaves the bag is what the seller asked to
    /// sell, and the request gives back anything the order could not take.
    /// </summary>
    public static void Sell(NetworkConnection connection, Player player, int orderId, int bagId,
        int count)
    {
        var bag = player.Inventory;
        if (bag == null || count <= 0)
            return;

        if (!bag.GetItem(bagId, out var item) || bag.GetItemCountByBagId(bagId) < count)
        {
            CommandBuilder.ErrorMessage(connection, "ของไม่พอ");
            return;
        }

        if (item.Type != ItemType.RegularItem)
        {
            CommandBuilder.ErrorMessage(connection, "ของชิ้นนี้ขายเข้าคำสั่งซื้อไม่ได้ ใช้ประมูลแทน");
            return;
        }

        if (player.Equipment != null && player.Equipment.IsItemEquipped(bagId))
        {
            CommandBuilder.ErrorMessage(connection, "ของที่ใส่อยู่ขายไม่ได้");
            return;
        }

        //--- nothing below here may fail -----------------------------------------
        if (!bag.RemoveItemByBagIdAndGetRemovedItem(bagId, count, out var removed))
        {
            CommandBuilder.ErrorMessage(connection, "ของไม่พอ");
            return;
        }

        //The bag changed and nothing carries that on its own, so without this the stack
        //sits there on screen looking untouched.
        CommandBuilder.SendUpdatePlayerData(player, true, false, player.HasCart);

        RoDatabase.EnqueueDbRequest(new BuyOrderSellRequest(player.Id, player.Name, orderId,
            removed.Id, count));
    }
}
