using RebuildSharedData.Data;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Custom.BossLog;

/// <summary>
/// A player's way through the boss log, and the two hats at the end of it.
/// </summary>
/// <remarks>
/// One prize, and it is a certificate: meet every boss in the world once and the plain Hat of
/// the Sun God is yours, no luck involved. What makes it hard is that bosses respawn once an
/// hour, so the only way through is a lot of evenings and knowing where everything stands.
///
/// The slotted one is not here. It comes out of the MVP box, which drops from MVPs at one
/// percent and holds it among a dozen other things - a lottery inside a lottery, and nothing
/// anybody can grind their way past. This log briefly had a lottery of its own for it, with a
/// guarantee at five hundred MVP kills, and the two could not both exist: a guarantee makes
/// the box pointless for the one thing that makes the box worth opening.
/// </remarks>
public static class BossLogProgress
{
    /// <summary>Set once the log is full and the plain hat has been handed over.</summary>
    private const string ClearFlag = "blclear";

    /// <summary>MVPs this character has killed, for the log to say so.</summary>
    private const string MvpKillsFlag = "blmvps";

    /// <summary>The plain hat: finish the log, it is yours.</summary>
    public const string PlainHatCode = "Hat_of_the_Sun_God";

    /// <summary>The slotted one, which comes out of the MVP box and nowhere else.</summary>
    public const string CrownedHatCode = "Hat_of_the_Sun_God_";

    public static int GetKills(Player player, BossLogEntry entry) => player.GetNpcFlag(entry.ProgressFlag);

    public static bool HasKilled(Player player, BossLogEntry entry) => GetKills(player, entry) > 0;

    public static bool HasCleared(Player player) => player.GetNpcFlag(ClearFlag) != 0;

    public static int MvpKills(Player player) => player.GetNpcFlag(MvpKillsFlag);

    /// <summary>How many of the log's entries this character has met at least once.</summary>
    public static int CountFound(Player player)
    {
        var found = 0;
        foreach (var entry in BossLog.Entries)
        {
            if (player.GetNpcFlag(entry.ProgressFlag) > 0)
                found++;
        }

        return found;
    }

    public static void RecordKill(Player player, BossLogEntry entry)
    {
        var kills = player.GetNpcFlag(entry.ProgressFlag);
        var isFirst = kills == 0;

        player.SetNpcFlag(entry.ProgressFlag, kills + 1);

        if (isFirst)
            AnnounceFirstMeeting(player, entry);

        //Checked on a first kill only. Nothing else can complete the log, and walking every
        //entry on every boss kill for a character who finished months ago is work for nothing.
        if (isFirst && !HasCleared(player))
            CheckCleared(player);

        //Counted whether or not the log is finished, because it is the number the log shows
        //and the number the box's odds are read against.
        if (entry.IsMvp)
            player.SetNpcFlag(MvpKillsFlag, player.GetNpcFlag(MvpKillsFlag) + 1);

        CommandBuilder.SendBossLogEntry(player, entry);
    }

    private static void CheckCleared(Player player)
    {
        if (BossLog.Total == 0 || CountFound(player) < BossLog.Total)
            return;

        //Written before the item is handed over, the same way everything else in the book is,
        //so an inventory that refuses cannot turn into a hat given twice.
        player.SetNpcFlag(ClearFlag, 1);

        var name = Give(player, PlainHatCode);
        ServerAnnouncements.Announce(name == null
            ? $"{player.Name} ล่าจอมมารครบทุกตัวในบันทึกล่าจอมมารแล้ว !"
            : $"ยินดีด้วย {player.Name} ล่าจอมมารครบทั้ง {BossLog.Total} ตัว ได้รับ {name} !");
    }

    /// <summary>
    /// Said to everybody the first time a character meets a boss.
    /// </summary>
    /// <remarks>
    /// Only the first, and only for an MVP. A mini boss dies often enough that announcing
    /// every first meeting would be a line a minute while somebody works through a dungeon;
    /// their own screen still says so.
    /// </remarks>
    private static void AnnounceFirstMeeting(Player player, BossLogEntry entry)
    {
        var found = CountFound(player);
        var line = $"บันทึกล่าจอมมาร: พบ {entry.Name} เป็นครั้งแรก  ({found}/{BossLog.Total})";

        if (entry.IsMvp)
            ServerAnnouncements.Announce($"ยินดีด้วย {player.Name} ล่า {entry.Name} ได้เป็นครั้งแรก  ({found}/{BossLog.Total} ตัวในบันทึก)");
        else
            Announce(player, $"<color=#66FFAA>{line}</color>");
    }

    private static string? Give(Player player, string code)
    {
        if (!DataManager.ItemIdByName.TryGetValue(code, out var itemId))
        {
            ServerLogger.LogError($"[BossLog] '{code}' is not an item, so {player.Name} was given nothing for it.");
            return null;
        }

        player.CreateItemInInventory(new ItemReference(itemId, 1));
        return DataManager.GetItemInfoById(itemId)?.Name ?? code;
    }

    internal static void Announce(Player player, string message)
    {
        if (player.Connection == null)
            return;

        CommandBuilder.AddRecipient(player.Connection);
        CommandBuilder.SendServerMessage(message, "");
        CommandBuilder.ClearRecipients();
    }
}
