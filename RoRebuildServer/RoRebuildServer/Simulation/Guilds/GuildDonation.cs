using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Simulation.Guilds;

/// <summary>
/// What a pile of junk is worth to a guild.
///
/// The scoring is not a table anybody has to write: the game already knows how often every
/// item drops, so an item is worth what it costs to find. A Jellopy falls off every Poring
/// and is worth one; an Oridecon turns up once in a thousand kills and is worth a thousand.
/// Nobody has to price two and a half thousand items by hand, and nothing can be mispriced
/// relative to anything else, because the same number decides both.
///
/// The effect is the point: the things people walk past become the things people pick up,
/// and a player who cannot fight a boss can still be the reason their guild levelled.
/// </summary>
public static class GuildDonation
{
    /// <summary>
    /// The most one item can be worth, however rare it is.
    ///
    /// Without it the tail of the drop table decides everything - a single item that falls
    /// one time in ten thousand would be worth a level on its own, and the whole system
    /// would be "wait for one lucky drop" rather than "bring what you find".
    /// </summary>
    public const int MaxPointsPerItem = 300;

    /// <summary>How much one player may hand over in a day, so a rich player cannot
    /// simply buy a guild to the top in an afternoon.</summary>
    public const int DailyLimit = 2000;

    private static Dictionary<int, int>? pointsByItem;

    /// <summary>
    /// Item id to what it is worth, built once from the drop tables.
    ///
    /// An item that several monsters drop is priced off the <b>easiest</b> of them. Scoring
    /// it off the rarest would make a Jellopy precious the moment some boss also drops one.
    /// </summary>
    private static Dictionary<int, int> Points()
    {
        if (pointsByItem != null)
            return pointsByItem;

        var best = new Dictionary<int, int>();

        foreach (var (_, drops) in DataManager.MonsterDropData)
        {
            foreach (var entry in drops.DropChances)
            {
                if (entry.Chance <= 0)
                    continue;

                if (!best.TryGetValue(entry.Id, out var chance) || entry.Chance > chance)
                    best[entry.Id] = entry.Chance;
            }
        }

        pointsByItem = new Dictionary<int, int>(best.Count);
        foreach (var (id, chance) in best)
        {
            //chances are out of ten thousand, so this is "one in how many kills"
            var points = 10000 / chance;
            if (points < 1)
                points = 1;
            if (points > MaxPointsPerItem)
                points = MaxPointsPerItem;

            pointsByItem[id] = points;
        }

        ServerLogger.Log($"Guild donation values built for {pointsByItem.Count} items.");
        return pointsByItem;
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

        if (!Points().TryGetValue(itemId, out var points))
        {
            //no monster drops it, so there is no honest price for it
            refusal = "ของชิ้นนี้ไม่มีมอนสเตอร์ดรอป เลยตีราคาไม่ได้";
            return 0;
        }

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
