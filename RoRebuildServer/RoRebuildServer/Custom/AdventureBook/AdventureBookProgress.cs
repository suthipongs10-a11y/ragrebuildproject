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
        if (!AdventureBook.EntriesByCardId.TryGetValue(itemId, out var entry))
            return;
        if (HasStar(player, entry, AdventureBookStars.Card))
            return;

        AwardStar(player, entry, AdventureBookStars.Card);
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
        foreach (var (cardId, entry) in AdventureBook.EntriesByCardId)
        {
            if (HasStar(player, entry, AdventureBookStars.Card))
                continue;
            if (!player.Inventory.HasItem(cardId))
                continue;

            AwardStar(player, entry, AdventureBookStars.Card);
            found++;
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
    private static (Reward hunt, Reward huntLarge) RewardsForLevel(int level) => level switch
    {
        < 30 => (new Reward("Concentration_Potion", 5), new Reward("Old_Blue_Box", 1)),
        < 60 => (new Reward("Awakening_Potion", 5), new Reward("Old_Blue_Box", 2)),
        _ => (new Reward("Berserk_Potion", 5), new Reward("Old_Violet_Box", 1))
    };

    private static void GiveReward(Player player, AdventureBookEntry entry, AdventureBookStars star)
    {
        var (hunt, huntLarge) = RewardsForLevel(entry.Level);
        var reward = star switch
        {
            AdventureBookStars.Hunt => hunt,
            AdventureBookStars.HuntLarge => huntLarge,
            _ => default
        };

        var target = star == AdventureBookStars.Hunt ? entry.HuntTarget : entry.HuntTargetLarge;
        var stars = star == AdventureBookStars.Hunt ? "★" : "★★";

        if (!string.IsNullOrEmpty(reward.Code) && DataManager.ItemIdByName.TryGetValue(reward.Code, out var itemId))
        {
            player.CreateItemInInventory(new ItemReference(itemId, reward.Count));
            var itemName = DataManager.GetItemInfoById(itemId)?.Name ?? reward.Code;
            Announce(player, $"<color=#66FFAA>สมุดผจญภัย {stars} กำจัด {entry.Name} ครบ {target:N0} ตัว — ได้รับ {itemName} x{reward.Count}</color>");
        }
        else
        {
            //Said out loud rather than swallowed: a star that pays nothing is a content bug,
            //and the player should still be told their star was recorded.
            ServerLogger.LogWarning($"[AdventureBook] The reward '{reward.Code}' for {entry.Name} is not an item, so nothing was given.");
            Announce(player, $"<color=#66FFAA>สมุดผจญภัย {stars} กำจัด {entry.Name} ครบ {target:N0} ตัว</color>");
        }
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
