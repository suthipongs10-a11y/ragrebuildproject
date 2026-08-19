using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Simulation.Guilds;

/// <summary>
/// What a pile of junk is worth to a guild.
///
/// Priced off what a shop pays for it, not off how often it drops.
///
/// The drop rate was the obvious answer and it does not work on this data: Oridecon,
/// Elunium, Steel and Iron Ore are all dropped at a hundred percent by something, so
/// scoring by "how hard is this to find" made all four of them worth exactly what a
/// Jellopy is worth. Seventy four percent of everything landed on one point, which is a
/// system with no opinion about anything.
///
/// The price is a number somebody chose per item, and it already says what the drop table
/// here does not: a Jellopy is worth one point, an Oridecon seventeen, a Royal Jelly forty
/// two. The square root keeps the top from running away - two hundred thousand zeny would
/// otherwise be worth more than everything else put together.
///
/// An item still has to drop from something to be donatable at all. That is what keeps the
/// seven hundred reward items - which have prices but no source - out of it.
/// </summary>
public static class GuildDonation
{
    /// <summary>
    /// The most one item can be worth, and the shape of the curve below it.
    ///
    /// Points are the square root of the price halved, so the spread runs from one for a
    /// Jellopy to three hundred for the few things worth hundreds of thousands, with the
    /// materials people actually carry landing between four and forty.
    /// </summary>
    public const int MaxPointsPerItem = 300;

    /// <summary>How much one player may hand over in a day, so a rich player cannot
    /// simply buy a guild to the top in an afternoon.</summary>
    public const int DailyLimit = 2000;

    private static HashSet<int>? droppedItems;

    /// <summary>
    /// Every item any monster drops, built once.
    ///
    /// Only whether it drops at all is asked, not how often: the rate decides nothing here
    /// any more, but "does anything in the world give this out" is exactly the line between
    /// a thing found while playing and a thing handed out as a reward.
    /// </summary>
    private static HashSet<int> Dropped()
    {
        if (droppedItems != null)
            return droppedItems;

        droppedItems = new HashSet<int>();
        foreach (var (_, drops) in DataManager.MonsterDropData)
        {
            foreach (var entry in drops.DropChances)
            {
                if (entry.Chance > 0)
                    droppedItems.Add(entry.Id);
            }
        }

        ServerLogger.Log($"Guild donation: {droppedItems.Count} items are droppable and so donatable.");
        return droppedItems;
    }

    /// <summary>
    /// What one of an item is worth, or zero if it cannot be donated at all.
    ///
    /// Refused: anything that does not drop - which is every reward item, every shop item
    /// and the seven hundred things nothing gives out - and cards and gear, which are worth
    /// far too much per piece and would let one person hand a guild several levels.
    /// </summary>
    public static int PointsFor(int itemId, out string refusal)
    {
        refusal = "";

        var info = DataManager.GetItemInfoById(itemId);
        if (info == null)
        {
            refusal = "ของชิ้นนี้บริจาคไม่ได้";
            return 0;
        }

        if (info.IsUnique || info.ItemClass == ItemClass.Card
                          || info.ItemClass == ItemClass.Weapon
                          || info.ItemClass == ItemClass.Equipment)
        {
            refusal = "การ์ดและอุปกรณ์บริจาคไม่ได้";
            return 0;
        }

        if (!Dropped().Contains(itemId))
        {
            //nothing in the world gives this out, so it is a reward rather than a find
            refusal = "ของชิ้นนี้ไม่มีมอนสเตอร์ดรอป บริจาคไม่ได้";
            return 0;
        }

        var points = (int)Math.Round(Math.Sqrt(Math.Max(info.Price, 1)) / 2d);
        if (points < 1)
            points = 1;
        if (points > MaxPointsPerItem)
            points = MaxPointsPerItem;

        return points;
    }

    /// <summary>Whether an item can be handed over at all, for the client's list.</summary>
    public static bool CanDonate(int itemId) => PointsFor(itemId, out _) > 0;

    //Kept on the player's own flag store rather than in a table: it is one number per
    //character that resets every day, and a column and a migration for that would be a
    //lot of machinery for something a dictionary already holds and already saves.
    private const string DayFlag = "guild_donate_day";
    private const string AmountFlag = "guild_donate_today";

    private static int Today() => (int)(DateTime.UtcNow - new DateTime(2020, 1, 1)).TotalDays;

    public static int RemainingToday(Player player)
    {
        if (player.GetNpcFlag(DayFlag) != Today())
            return DailyLimit;

        var used = player.GetNpcFlag(AmountFlag);
        return used >= DailyLimit ? 0 : DailyLimit - used;
    }

    public static void RecordDonation(Player player, int points)
    {
        if (player.GetNpcFlag(DayFlag) != Today())
        {
            player.SetNpcFlag(DayFlag, Today());
            player.SetNpcFlag(AmountFlag, 0);
        }

        player.SetNpcFlag(AmountFlag, player.GetNpcFlag(AmountFlag) + points);
    }
}
