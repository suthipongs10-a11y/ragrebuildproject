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
/// Two prizes, and they are earned in completely different ways on purpose.
///
/// The plain Hat of the Sun God is a certificate: meet every boss in the world once and it is
/// yours, no luck involved. What makes it hard is that bosses respawn once an hour, so the
/// only way through is a lot of evenings and knowing where everything stands.
///
/// The slotted one is a lottery, and it only opens once the certificate is in hand. Every MVP
/// killed after that rolls for it. That is the shape a legendary item has in this game - a
/// number nobody can grind their way past - with one change: a floor under it, so that being
/// unlucky is a longer wait rather than a permanent no.
/// </remarks>
public static class BossLogProgress
{
    /// <summary>Set once the log is full and the plain hat has been handed over.</summary>
    private const string ClearFlag = "blclear";

    /// <summary>Set once the slotted hat has been handed over. It is given once, ever.</summary>
    private const string CrownFlag = "blcrown";

    /// <summary>MVPs killed since the log was finished, which is what the lottery counts.</summary>
    private const string MvpSinceClearFlag = "blmvps";

    /// <summary>The plain hat: finish the log, it is yours.</summary>
    public const string PlainHatCode = "Hat_of_the_Sun_God";

    /// <summary>The slotted one. Nothing else in the game hands this out.</summary>
    public const string CrownedHatCode = "Hat_of_the_Sun_God_";

    /// <summary>In ten thousand, per MVP killed once the log is finished. A hundred is one percent.</summary>
    public const int CrownChance = 100;

    /// <summary>
    /// The MVP kill it stops being a lottery and is simply given.
    /// </summary>
    /// <remarks>
    /// Five times the average wait. Almost nobody reaches it - the roll lands long before -
    /// but it is the difference between an item that is rare and an item somebody can spend a
    /// year not getting, and the second one is not a prize, it is a grudge.
    /// </remarks>
    public const int CrownPity = 500;

    public static int GetKills(Player player, BossLogEntry entry) => player.GetNpcFlag(entry.ProgressFlag);

    public static bool HasKilled(Player player, BossLogEntry entry) => GetKills(player, entry) > 0;

    public static bool HasCleared(Player player) => player.GetNpcFlag(ClearFlag) != 0;

    public static bool HasCrown(Player player) => player.GetNpcFlag(CrownFlag) != 0;

    public static int MvpKillsSinceClear(Player player) => player.GetNpcFlag(MvpSinceClearFlag);

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

        //The lottery counts MVPs, not mini bosses. A mini boss is half an hour away and an
        //MVP is an evening, and the prize should cost the evening.
        if (entry.IsMvp && HasCleared(player))
            RollForCrown(player);

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

    private static void RollForCrown(Player player)
    {
        if (HasCrown(player))
            return;

        var kills = player.GetNpcFlag(MvpSinceClearFlag) + 1;
        player.SetNpcFlag(MvpSinceClearFlag, kills);

        var won = GameRandom.Next(10000) < CrownChance;
        if (!won && kills < CrownPity)
            return;

        player.SetNpcFlag(CrownFlag, 1);

        var name = Give(player, CrownedHatCode);
        if (name == null)
            return;

        ServerAnnouncements.Announce($"ตำนานบทใหม่ ! {player.Name} ได้รับ {name} (เจาะรู) จากการล่า MVP ครั้งที่ {kills:N0} !");
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
