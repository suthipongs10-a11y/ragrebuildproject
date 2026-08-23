using RoRebuildServer.EntityComponents;

namespace RoRebuildServer.Custom.AdventureBook;

/// <summary>
/// Reading the book by typing at it, until there is a window to open.
/// </summary>
/// <remarks>
/// Deliberately hung off ordinary chat rather than given a packet of its own. A packet would
/// mean a new PacketType, which lives in RebuildSharedData, which the client only sees after
/// updateclient.bat has copied the dll across - and until then every build fails naming an
/// enum member that is plainly right there in the source. A line of chat costs none of that
/// and works against a client nobody rebuilt.
///
/// It stays useful once the window exists: a window shows what it was written to show, and
/// this shows whatever is asked of it.
/// </remarks>
public static class AdventureBookChat
{
    private const string Prefix = "!book";

    /// <summary>Answers the message if it was for us, and says whether it was.</summary>
    public static bool TryHandle(Player player, string text)
    {
        if (string.IsNullOrWhiteSpace(text) || !text.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase))
            return false;

        //"!bookshelf" is somebody talking, not somebody asking.
        if (text.Length > Prefix.Length && !char.IsWhiteSpace(text[Prefix.Length]))
            return false;

        if (!AdventureBookManager.IsEnabled || !AdventureBook.IsBuilt)
        {
            AdventureBookProgress.Announce(player, "สมุดผจญภัยยังไม่เปิดใช้งานบนเซิร์ฟเวอร์นี้");
            return true;
        }

        //Swept every time somebody looks, which catches cards that were already in a bag
        //before any of this existed as well as any route in that skips AddItemToInventory.
        var newCards = AdventureBookProgress.ScanInventoryForCards(player);
        if (newCards > 0)
            AdventureBookProgress.Announce(player, $"<color=#66FFAA>พบการ์ดในกระเป๋าที่ยังไม่ได้บันทึก {newCards} ใบ บันทึกให้แล้ว</color>");

        var search = text.Length > Prefix.Length ? text.Substring(Prefix.Length).Trim() : string.Empty;

        if (search.Length > 0)
            ShowOneMonster(player, search);
        else
            ShowSummary(player);

        return true;
    }

    private static void ShowSummary(Player player)
    {
        var stars = AdventureBookProgress.CountStars(player);
        var rank = AdventureBookProgress.RefreshRank(player);
        var nextRank = AdventureBookRank.StarsForNextRank(rank);
        var toNext = nextRank > 0 ? $"  (อีก {nextRank - stars:N0} ดาวถึงระดับ {rank + 1})" : string.Empty;

        AdventureBookProgress.Announce(player,
            $"<color=#66FFAA>สมุดผจญภัย: {stars} ดาว จาก {AdventureBook.StarTotal}  ·  Adventure ระดับ {rank}</color>{toNext}");

        //Whatever is closest to its next star, because that is what somebody asking is
        //deciding whether to go back for. A page never touched has nothing to say yet.
        var started = new List<(AdventureBookEntry entry, int kills, int next)>();
        foreach (var entry in AdventureBook.EntriesByMonsterId.Values)
        {
            var kills = AdventureBookProgress.GetKills(player, entry);
            if (kills <= 0)
                continue;

            var next = kills < entry.HuntTarget ? entry.HuntTarget : entry.HuntTargetLarge;
            started.Add((entry, kills, next));
        }

        if (started.Count == 0)
        {
            AdventureBookProgress.Announce(player, "  ยังไม่ได้เริ่มหน้าไหนเลย ออกไปล่ามอนสักตัวก่อน");
            return;
        }

        started.Sort((a, b) => (b.kills * 100 / b.next).CompareTo(a.kills * 100 / a.next));

        var shown = 0;
        foreach (var (entry, kills, next) in started)
        {
            if (shown++ >= 8)
                break;

            var earned = AdventureBookProgress.GetStars(player, entry);
            var marks = new string('★', System.Numerics.BitOperations.PopCount((uint)earned));
            AdventureBookProgress.Announce(player, $"  {entry.Name} — {kills:N0}/{next:N0}  {marks}  [{entry.Region}]");
        }

        if (started.Count > shown)
            AdventureBookProgress.Announce(player, $"  ...และอีก {started.Count - shown} ตัว");

        AdventureBookProgress.Announce(player, "พิมพ์ !book <ชื่อมอน> เพื่อดูตัวเดียว");
    }

    private static void ShowOneMonster(Player player, string search)
    {
        AdventureBookEntry? found = null;
        foreach (var entry in AdventureBook.EntriesByMonsterId.Values)
        {
            if (entry.Name.Equals(search, StringComparison.OrdinalIgnoreCase))
            {
                found = entry;
                break;
            }

            //Held rather than taken, so an exact name later in the list still wins over a
            //partial one found early: typing "Poring" should not land on Poporing.
            if (found == null && entry.Name.Contains(search, StringComparison.OrdinalIgnoreCase))
                found = entry;
        }

        if (found == null)
        {
            AdventureBookProgress.Announce(player, $"ไม่พบ '{search}' ในสมุด (อาจเป็นบอส ต้นไม้ หรือมอนนอกภูมิภาค)");
            return;
        }

        var kills = AdventureBookProgress.GetKills(player, found);
        var earned = AdventureBookProgress.GetStars(player, found);

        AdventureBookProgress.Announce(player, $"<color=#66FFAA>{found.Name}  [{found.Region}]  Lv {found.Level}</color>");
        AdventureBookProgress.Announce(player, $"  ★  {kills:N0}/{found.HuntTarget:N0}" + Mark(earned, AdventureBookStars.Hunt));
        AdventureBookProgress.Announce(player, $"  ★★ {kills:N0}/{found.HuntTargetLarge:N0}" + Mark(earned, AdventureBookStars.HuntLarge));

        if (found.CardItemId > 0)
            AdventureBookProgress.Announce(player, "  ★★★ ต้องมีการ์ดของมอนตัวนี้" + Mark(earned, AdventureBookStars.Card));
        else
            AdventureBookProgress.Announce(player, "  ★★★ มอนตัวนี้ไม่ดรอปการ์ด หน้านี้จบที่ 2 ดาว");

        var places = found.Sightings;
        if (places.Length == 0)
            return;

        var list = new List<string>();
        for (var i = 0; i < places.Length && i < 5; i++)
            list.Add($"{places[i].Map} ({places[i].Count})");

        var more = places.Length > 5 ? $" และอีก {places.Length - 5} แมพ" : string.Empty;
        AdventureBookProgress.Announce(player, "  เจอที่: " + string.Join(", ", list) + more);
    }

    private static string Mark(AdventureBookStars earned, AdventureBookStars star) => (earned & star) != 0 ? "  ✔" : string.Empty;
}
