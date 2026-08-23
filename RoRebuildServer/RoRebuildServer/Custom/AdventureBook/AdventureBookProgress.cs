using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Custom.AdventureBook;

[Flags]
public enum AdventureBookStars
{
    None = 0,
    Hunt = 1,
    HuntLarge = 2,
    Card = 4
}

/// <summary>
/// A player's progress through the book, and the awarding of it.
/// </summary>
/// <remarks>
/// Everything lives in the npc flag dictionary the character already saves, so there is no
/// schema to migrate and no table to keep in step. One flag per monster rather than two: the
/// kill count is shifted up three bits and the stars already awarded ride in the bottom
/// three, which halves the number of keys a character carries and keeps a save that now has
/// a couple of hundred of them small.
///
/// The stars are recorded rather than inferred from the count so that awarding is idempotent.
/// Inferring would mean that lowering a target later pays everyone who was already past the
/// new line a second time, and that a rounding change to the formula quietly hands out prizes.
/// </remarks>
public static class AdventureBookProgress
{
    private const int StarShift = 3;
    private const int StarMask = 0b111;

    public static int GetKills(Player player, AdventureBookEntry entry) => player.GetNpcFlag(entry.ProgressFlag) >> StarShift;

    public static AdventureBookStars GetStars(Player player, AdventureBookEntry entry) =>
        (AdventureBookStars)(player.GetNpcFlag(entry.ProgressFlag) & StarMask);

    public static bool HasStar(Player player, AdventureBookEntry entry, AdventureBookStars star) => (GetStars(player, entry) & star) != 0;

    /// <summary>Total stars earned across the whole book, which is what adventure rank is read from.</summary>
    public static int CountStars(Player player)
    {
        var total = 0;
        foreach (var entry in AdventureBook.EntriesByMonsterId.Values)
        {
            var stars = (int)GetStars(player, entry);
            //Three ones in a row, so popcount is the star count.
            total += System.Numerics.BitOperations.PopCount((uint)stars);
        }

        return total;
    }

    public static void AwardStar(Player player, AdventureBookEntry entry, AdventureBookStars star)
    {
        var stored = player.GetNpcFlag(entry.ProgressFlag);
        if (((AdventureBookStars)(stored & StarMask) & star) != 0)
            return; //already paid for

        player.SetNpcFlag(entry.ProgressFlag, stored | (int)star);
        GiveReward(player, entry, star);
        CheckRegionComplete(player, entry.Region);
        RefreshRank(player);
        CommandBuilder.SendAdventureBookPage(player, entry);
    }

    /// <summary>
    /// Fills in the third star of whatever page this item completes, if it completes one.
    /// </summary>
    /// <remarks>
    /// Called from the one place every item entering a bag passes through, so a card counts
    /// whether it was picked up off the floor, traded for, bought off the market or pulled
    /// out of storage. The card is not taken: it is worth real money on the market this
    /// server already has, and a page that eats one is a page nobody dares finish.
    /// </remarks>
    public static void OnItemGained(Player player, int itemId)
    {
        if (!AdventureBook.IsBuilt)
            return;
        if (!AdventureBook.EntriesByCardId.TryGetValue(itemId, out var sharing))
            return;

        //Every page this card belongs to, not just the first. The goblins all drop the same
        //one, and filling only whichever of them happened to be built first left the rest of
        //Geffen Fields permanently one star short of its reward.
        foreach (var entry in sharing)
        {
            if (HasStar(player, entry, AdventureBookStars.Card))
                continue;

            AwardStar(player, entry, AdventureBookStars.Card);
        }
    }

    /// <summary>
    /// Sweeps the whole bag for cards whose page is still open.
    /// </summary>
    /// <remarks>
    /// A backstop for cards that were already sitting in a bag before any of this existed,
    /// and for any route into an inventory that does not pass through AddItemToInventory.
    /// Cheap enough to run whenever somebody looks at their book.
    /// </remarks>
    public static int ScanInventoryForCards(Player player)
    {
        if (!AdventureBook.IsBuilt || player.Inventory == null)
            return 0;

        var found = 0;
        foreach (var (cardId, sharing) in AdventureBook.EntriesByCardId)
        {
            if (!player.Inventory.HasItem(cardId))
                continue;

            foreach (var entry in sharing)
            {
                if (HasStar(player, entry, AdventureBookStars.Card))
                    continue;

                AwardStar(player, entry, AdventureBookStars.Card);
                found++;
            }
        }

        return found;
    }

    /// <summary>
    /// Hands over a region's headgear once every page in it is full.
    /// </summary>
    /// <remarks>
    /// Checked after each star rather than on a timer, because the moment somebody finishes
    /// is the moment they should hear about it. The flag is set before the item is given so
    /// that an inventory error cannot turn into an endless loop of announcements.
    /// </remarks>
    private static void CheckRegionComplete(Player player, string regionName)
    {
        AdventureBookRegion? region = null;
        foreach (var r in AdventureBook.Regions)
        {
            if (!string.Equals(r.Name, regionName, StringComparison.OrdinalIgnoreCase))
                continue;
            region = r;
            break;
        }

        if (region == null || player.GetNpcFlag(region.CompletionFlag) != 0)
            return;

        foreach (var entry in region.Entries)
        {
            var stars = GetStars(player, entry);
            if ((stars & AdventureBookStars.Hunt) == 0 || (stars & AdventureBookStars.HuntLarge) == 0)
                return;
            if (entry.CardItemId > 0 && (stars & AdventureBookStars.Card) == 0)
                return;
        }

        player.SetNpcFlag(region.CompletionFlag, 1);

        if (!DataManager.ItemIdByName.TryGetValue(region.RewardHeadgear, out var itemId))
        {
            ServerLogger.LogError($"[AdventureBook] {player.Name} finished {region.Name} but '{region.RewardHeadgear}' is not an item, so nothing was given.");
            return;
        }

        player.CreateItemInInventory(new ItemReference(itemId, 1));
        var itemName = DataManager.GetItemInfoById(itemId)?.Name ?? region.RewardHeadgear;

        Announce(player, $"<color=#FFD700>สมุดผจญภัย: บันทึก {region.Name} ครบทุกหน้าแล้ว — ได้รับ {itemName}</color>");
        ServerAnnouncements.Announce($"{player.Name} บันทึก {region.Name} ครบทุกหน้าในสมุดผจญภัย ได้รับ {itemName} !");
    }

    /// <summary>
    /// Adds one to a player's tally for this monster and pays out anything that tips over.
    /// </summary>
    public static void RecordKill(Player player, AdventureBookEntry entry)
    {
        var stored = player.GetNpcFlag(entry.ProgressFlag);
        var kills = (stored >> StarShift) + 1;
        var stars = (AdventureBookStars)(stored & StarMask);

        var earned = AdventureBookStars.None;
        if ((stars & AdventureBookStars.Hunt) == 0 && kills >= entry.HuntTarget)
            earned |= AdventureBookStars.Hunt;
        if ((stars & AdventureBookStars.HuntLarge) == 0 && kills >= entry.HuntTargetLarge)
            earned |= AdventureBookStars.HuntLarge;

        player.SetNpcFlag(entry.ProgressFlag, (kills << StarShift) | (int)(stars | earned));

        if (earned == AdventureBookStars.None)
            return;

        if ((earned & AdventureBookStars.Hunt) != 0)
            GiveReward(player, entry, AdventureBookStars.Hunt);
        if ((earned & AdventureBookStars.HuntLarge) != 0)
            GiveReward(player, entry, AdventureBookStars.HuntLarge);

        //A page whose last star was a hunting one finishes a region just as surely as a card.
        CheckRegionComplete(player, entry.Region);
        RefreshRank(player);

        //Only when something actually moved. Sending on every kill would put a packet per
        //monster per player on the wire for a window most of them do not have open.
        CommandBuilder.SendAdventureBookPage(player, entry);
    }

    private readonly record struct Reward(string Code, int Count);

    /// <summary>
    /// What a star pays, by how dangerous the thing that had to die was.
    /// </summary>
    /// <remarks>
    /// Level rather than region, so a stray high level monster on a beginner map is worth
    /// what it costs to kill. Nothing here pays zeny on purpose: money can be earned any
    /// number of ways already, and the point of the book is to hand over things that cannot.
    /// </remarks>
    private static (Reward hunt, Reward huntLarge, Reward card) RewardsForLevel(int level) => level switch
    {
        < 30 => (new Reward("Concentration_Potion", 5), new Reward("Old_Blue_Box", 1), new Reward("Old_Card_Album", 1)),
        < 60 => (new Reward("Awakening_Potion", 5), new Reward("Old_Blue_Box", 2), new Reward("Old_Card_Album", 1)),
        _ => (new Reward("Berserk_Potion", 5), new Reward("Old_Violet_Box", 1), new Reward("Old_Card_Album", 2))
    };

    private static void GiveReward(Player player, AdventureBookEntry entry, AdventureBookStars star)
    {
        var (hunt, huntLarge, card) = RewardsForLevel(entry.Level);
        var reward = star switch
        {
            AdventureBookStars.Hunt => hunt,
            AdventureBookStars.HuntLarge => huntLarge,
            AdventureBookStars.Card => card,
            _ => default
        };

        var line = star switch
        {
            AdventureBookStars.Hunt => $"สมุดผจญภัย ★ กำจัด {entry.Name} ครบ {entry.HuntTarget:N0} ตัว",
            AdventureBookStars.HuntLarge => $"สมุดผจญภัย ★★ กำจัด {entry.Name} ครบ {entry.HuntTargetLarge:N0} ตัว",
            AdventureBookStars.Card => $"สมุดผจญภัย ★★★ บันทึกการ์ดของ {entry.Name} แล้ว",
            _ => $"สมุดผจญภัย {entry.Name}"
        };

        if (!string.IsNullOrEmpty(reward.Code) && DataManager.ItemIdByName.TryGetValue(reward.Code, out var itemId))
        {
            player.CreateItemInInventory(new ItemReference(itemId, reward.Count));
            var itemName = DataManager.GetItemInfoById(itemId)?.Name ?? reward.Code;
            Announce(player, $"<color=#66FFAA>{line} — ได้รับ {itemName} x{reward.Count}</color>");
        }
        else
        {
            //Said out loud rather than swallowed: a star that pays nothing is a content bug,
            //and the player should still be told their star was recorded.
            ServerLogger.LogWarning($"[AdventureBook] The reward '{reward.Code}' for {entry.Name} is not an item, so nothing was given.");
            Announce(player, $"<color=#66FFAA>{line}</color>");
        }

        //Only the third star reaches the whole server. It is the one that needs a card, and a
        //card is a tenth of a percent of a kill - rare enough that hearing about somebody
        //else's reads as news rather than as noise. Announcing the hunting stars as well
        //would put a line on every screen every few minutes and teach everyone to ignore them.
        if (star == AdventureBookStars.Card)
            AnnounceThirdStar(player, entry);
    }

    private static void AnnounceThirdStar(Player player, AdventureBookEntry entry)
    {
        var stars = CountStars(player);
        var rank = AdventureBookRank.RankFor(stars, HasEveryRegion(player));

        ServerAnnouncements.Announce($"ยินดีด้วย {player.Name} [Adventure ระดับ {rank}] ทำเควสระดับ 3 ดาว ของ {entry.Name} สำเร็จ !");
    }

    /// <summary>
    /// The flag holding a cached rank, stored one higher than it is so that a zero means
    /// nobody has worked it out yet rather than meaning rank zero.
    /// </summary>
    private const string RankFlag = "abrank";

    /// <summary>
    /// A player's adventure rank, counted once and then remembered.
    /// </summary>
    /// <remarks>
    /// Counting means walking every page in the book, and UpdateStats - which is where the
    /// rank's bonuses go on - runs on every equipment change, every level, and every buff.
    /// Doing the walk there would put a few hundred dictionary lookups on a path that has no
    /// business being slow. It is recounted at the only moment it can change, which is when a
    /// star is awarded.
    /// </remarks>
    public static int GetRank(Player player)
    {
        var stored = player.GetNpcFlag(RankFlag);
        if (stored > 0)
            return stored - 1;

        //Nobody has counted for this character yet, which is every character that existed
        //before the rank did. Counted and written down, but nothing is rebuilt from here:
        //this is reached from inside UpdateStats, and asking UpdateStats to run again from
        //the middle of itself is a mess whether or not it terminates.
        var rank = Count(player);
        player.SetNpcFlag(RankFlag, rank + 1);
        return rank;
    }

    /// <summary>
    /// Recounts the rank and, if it moved, rebuilds the stats so the new bonuses are real.
    /// </summary>
    /// <remarks>
    /// Only ever called from outside UpdateStats - when a star lands, or when somebody opens
    /// their book - so the rebuild it asks for is a plain call rather than a reentrant one.
    /// </remarks>
    public static int RefreshRank(Player player)
    {
        var rank = Count(player);
        var stored = player.GetNpcFlag(RankFlag);
        if (stored == rank + 1)
            return rank;

        player.SetNpcFlag(RankFlag, rank + 1);

        //The bonuses ride on UpdateStats, so a rank that just went up is worth nothing until
        //the stats are rebuilt.
        player.UpdateStats();

        if (stored > 0 && rank > stored - 1)
            Announce(player, $"<color=#FFD700>Adventure ระดับ {rank} แล้ว !</color>");

        return rank;
    }

    private static int Count(Player player) =>
        AdventureBookRank.RankFor(CountStars(player), HasEveryRegion(player));

    /// <summary>Whether every region in the book has been finished, which is the last rank.</summary>
    public static bool HasEveryRegion(Player player)
    {
        if (AdventureBook.Regions.Count == 0)
            return false;

        foreach (var region in AdventureBook.Regions)
        {
            if (player.GetNpcFlag(region.CompletionFlag) == 0)
                return false;
        }

        return true;
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
