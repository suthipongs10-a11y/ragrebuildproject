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

    /// <summary>
    /// Set once a character's pages have been moved to the flag names they use now.
    /// </summary>
    /// <remarks>
    /// One dictionary lookup guards the whole thing, which is why it is safe to ask for it
    /// on the kill path. Without it a page renamed by a content update reads as untouched,
    /// and every star on it is paid a second time.
    /// </remarks>
    private const string MigrationFlag = "abmoved";

    /// <summary>
    /// Moves a character's progress onto the flag names the book uses now.
    /// </summary>
    /// <remarks>
    /// Merged rather than copied - the highest kill count and every star either name holds -
    /// because a page that was renamed twice can have progress under two old names, and
    /// taking one of them would lose the other. Stars are bits, so merging them can only
    /// ever fill a page in, never empty it, which is the direction that cannot cost anybody
    /// a reward they already earned or hand them one they already had.
    ///
    /// The old names are cleared afterwards so a later page cannot pick them up again.
    /// </remarks>
    public static void EnsureMigrated(Player player)
    {
        if (!AdventureBook.IsBuilt || player.GetNpcFlag(MigrationFlag) != 0)
            return;

        var moved = 0;
        foreach (var entry in AdventureBook.EntriesByPageId.Values)
        {
            if (entry.LegacyProgressFlags.Length == 0)
                continue;

            var current = player.GetNpcFlag(entry.ProgressFlag);
            var kills = current >> StarShift;
            var stars = current & StarMask;
            var found = false;

            foreach (var old in entry.LegacyProgressFlags)
            {
                if (old == entry.ProgressFlag)
                    continue;

                var value = player.GetNpcFlag(old);
                if (value == 0)
                    continue;

                found = true;
                kills = Math.Max(kills, value >> StarShift);
                stars |= value & StarMask;
                player.SetNpcFlag(old, 0);
            }

            if (!found)
                continue;

            player.SetNpcFlag(entry.ProgressFlag, (kills << StarShift) | stars);
            moved++;
        }

        //Marked done only once it is done. The merge is safe to repeat - the old names are
        //cleared as they are read, so a second pass finds nothing - so the cost of stopping
        //halfway is one wasted pass rather than a page of progress nobody can get back.
        player.SetNpcFlag(MigrationFlag, 1);

        if (moved > 0)
            ServerLogger.Log($"[AdventureBook] Moved {moved} page(s) of {player.Name}'s progress onto the current flag names.");
    }

    public static int GetKills(Player player, AdventureBookEntry entry) => player.GetNpcFlag(entry.ProgressFlag) >> StarShift;

    public static AdventureBookStars GetStars(Player player, AdventureBookEntry entry) =>
        (AdventureBookStars)(player.GetNpcFlag(entry.ProgressFlag) & StarMask);

    public static bool HasStar(Player player, AdventureBookEntry entry, AdventureBookStars star) => (GetStars(player, entry) & star) != 0;

    /// <summary>Total stars earned across the whole book, which is what adventure rank is read from.</summary>
    public static int CountStars(Player player)
    {
        var total = 0;
        //Pages, not monsters. EntriesByMonsterId has five goblins pointing at one page,
        //and counting through that would score the goblins' stars five times each.
        foreach (var entry in AdventureBook.EntriesByPageId.Values)
        {
            var stars = (int)GetStars(player, entry);
            //Three ones in a row, so popcount is the star count.
            total += System.Numerics.BitOperations.PopCount((uint)stars);
        }

        return total;
    }

    public static void AwardStar(Player player, AdventureBookEntry entry, AdventureBookStars star)
    {
        EnsureMigrated(player);

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
    /// Fills in the third star of whatever page this card completes, if it completes one.
    /// </summary>
    /// <remarks>
    /// Only a card a monster died to leave on the ground, taken off that ground by this
    /// player. Everything else is deliberately worth nothing: a card bought off the market,
    /// handed over in a trade, pulled out of storage, opened out of an Old Card Album, or
    /// created by an admin. The page says "collected the card of X", and the only way to
    /// mean that is to have killed an X.
    ///
    /// It used to hang off AddItemToInventory instead, which every one of those routes goes
    /// through. Three stars was then a shopping trip - and worse, the album handed out as a
    /// three star reward paid for the next three star page, which paid for another album.
    ///
    /// The source monster is checked against the page rather than trusted, because a card
    /// and a page are matched by which monsters drop it: a card off something not on this
    /// page is a card off a drop table that has moved, and it should not quietly count.
    ///
    /// The card itself is not taken. It is worth real money on the market this server
    /// already has, and a page that eats one is a page nobody dares finish.
    /// </remarks>
    public static void OnCardPickedUpFromMonster(Player player, int itemId, int sourceMonsterId)
    {
        if (!AdventureBook.IsBuilt || sourceMonsterId <= 0)
            return;
        if (!AdventureBook.EntriesByCardId.TryGetValue(itemId, out var entry))
            return;
        if (HasStar(player, entry, AdventureBookStars.Card))
            return;
        if (Array.IndexOf(entry.MonsterIds, sourceMonsterId) < 0)
            return;

        AwardStar(player, entry, AdventureBookStars.Card);
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

        //Said once, to everybody. The announcement reaches the player who earned it as well,
        //so a second copy addressed only to them is the same sentence twice in a row.
        ServerAnnouncements.Announce($"ยินดีด้วย {player.Name} บันทึก {region.Name} ครบทุกหน้าในสมุดผจญภัย ได้รับ {itemName} !");
    }

    /// <summary>
    /// Adds one to a player's tally for this monster and pays out anything that tips over.
    /// </summary>
    public static void RecordKill(Player player, AdventureBookEntry entry)
    {
        EnsureMigrated(player);

        var stored = player.GetNpcFlag(entry.ProgressFlag);
        var kills = (stored >> StarShift) + 1;
        var stars = (AdventureBookStars)(stored & StarMask);

        var earned = AdventureBookStars.None;
        if ((stars & AdventureBookStars.Hunt) == 0 && kills >= entry.HuntTarget)
            earned |= AdventureBookStars.Hunt;
        if ((stars & AdventureBookStars.HuntLarge) == 0 && kills >= entry.HuntTargetLarge)
            earned |= AdventureBookStars.HuntLarge;

        player.SetNpcFlag(entry.ProgressFlag, (kills << StarShift) | (int)(stars | earned));

        if (earned != AdventureBookStars.None)
        {
            if ((earned & AdventureBookStars.Hunt) != 0)
                GiveReward(player, entry, AdventureBookStars.Hunt);
            if ((earned & AdventureBookStars.HuntLarge) != 0)
                GiveReward(player, entry, AdventureBookStars.HuntLarge);

            //A page whose last star was a hunting one finishes a region just as surely as a card.
            CheckRegionComplete(player, entry.Region);
            RefreshRank(player);
        }

        //Sent on every kill, not only when a star lands. It was the other way round at first,
        //on the reasoning that a packet per kill is waste for a window most people do not have
        //open - but a counter that only moves at 100 and 300 is indistinguishable from a
        //counter that is broken, and that is what it looked like. The packet is ten bytes and
        //everything in it is read from a cached flag, so there is no walk of the book behind
        //it either.
        CommandBuilder.SendAdventureBookPage(player, entry);
    }

    private static void GiveReward(Player player, AdventureBookEntry entry, AdventureBookStars star)
    {
        //Said in words rather than with star glyphs. This goes to the banner across the top
        //of the screen as well as to the chat log, and the two are not drawn in the same font
        //- the chat font has a star in it and the interface font draws an empty box.
        var line = star switch
        {
            AdventureBookStars.Hunt => $"ระดับ 1 ดาว (กำจัด {entry.Name} ครบ {entry.HuntTarget:N0} ตัว)",
            AdventureBookStars.HuntLarge => $"ระดับ 2 ดาว (กำจัด {entry.Name} ครบ {entry.HuntTargetLarge:N0} ตัว)",
            AdventureBookStars.Card => $"ระดับ 3 ดาว (เก็บการ์ดของ {entry.Name} ได้)",
            _ => entry.Name
        };

        var given = new List<string>();
        foreach (var reward in AdventureBookRewards.For(entry.Level, star))
        {
            if (!DataManager.ItemIdByName.TryGetValue(reward.Code, out var itemId))
            {
                //Said out loud rather than swallowed: a reward that names nothing is a content
                //bug, and finding out at the moment a player earns it is finding out too late.
                ServerLogger.LogWarning($"[AdventureBook] The reward '{reward.Code}' for {entry.Name} is not an item, so nothing was given.");
                continue;
            }

            player.CreateItemInInventory(new ItemReference(itemId, reward.Count));
            var itemName = DataManager.GetItemInfoById(itemId)?.Name ?? reward.Code;
            given.Add(reward.Count > 1 ? $"{itemName} x{reward.Count}" : itemName);
        }

        //Every star reaches the whole server, not only the third one.
        //
        //It was the third only at first, on the reasoning that a hunting star lands every few
        //minutes and a line on everybody's screen that often teaches people to ignore all of
        //them. On a server of a handful of friends that reasoning is backwards: the lines are
        //what make the place feel occupied, and there is nothing else saying anybody else is
        //playing. If it ever does get loud, HuntStarsBanner is the one word to change - the
        //hunting stars then go to the chat log and only the milestones take the banner.
        var rank = GetRank(player);
        var earned = given.Count > 0 ? $" ได้รับ {string.Join(", ", given)}" : string.Empty;
        var news = $"ยินดีด้วย {player.Name} [Adventure ระดับ {rank}] ทำเควสสมุดผจญภัย {entry.Name} {line} สำเร็จ{earned}";

        if (HuntStarsBanner || star == AdventureBookStars.Card)
            ServerAnnouncements.Announce(news);
        else
            ServerAnnouncements.AnnounceToChat(news);
    }

    /// <summary>
    /// Whether a hunting star takes the banner across the top of every screen, or only the
    /// chat log. The third star and the milestones always take the banner.
    /// </summary>
    /// <remarks>
    /// A field rather than a constant so the branch below it stays live code. A const here
    /// makes one arm of the test unreachable, and the compiler says so every build.
    /// </remarks>
    private static readonly bool HuntStarsBanner = true;


    /// <summary>
    /// The flag holding a cached rank, stored one higher than it is so that a zero means
    /// nobody has worked it out yet rather than meaning rank zero.
    /// </summary>
    private const string RankFlag = "abrank";

    /// <summary>
    /// The star count, cached beside the rank.
    /// </summary>
    /// <remarks>
    /// Counted the same way and for the same reason: the window's header wants it on every
    /// kill, and working it out means walking every page in the book. Stored one higher than
    /// it is so a zero means nobody has counted rather than meaning no stars.
    /// </remarks>
    private const string StarFlag = "abstars";

    /// <summary>
    /// The highest rank this character has ever been paid for, stored one higher than it is.
    /// </summary>
    /// <remarks>
    /// Kept apart from the current rank because the current rank can go down, and the pair
    /// "pay for every rank between the old one and the new one" is only safe if the old one
    /// never moves backwards. It does. Rank is counted from stars in the book as it stands,
    /// and the book is built from the maps that loaded - so importing fewer maps lowers
    /// somebody's star count, and the last rank asks for every region, so adding a region
    /// takes rank ten away from whoever had it. Both undo themselves later, and without a
    /// mark that only ever rises, the way back up pays for the whole climb a second time.
    /// The last rank is a full Valkyrie set.
    /// </remarks>
    private const string PaidRankFlag = "abpaid";

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
    /// <summary>The star count without walking the book, for anything on a per kill path.</summary>
    public static int CachedStars(Player player)
    {
        var stored = player.GetNpcFlag(StarFlag);
        if (stored > 0)
            return stored - 1;

        var stars = CountStars(player);
        player.SetNpcFlag(StarFlag, stars + 1);
        return stars;
    }

    public static int GetRank(Player player)
    {
        var stored = player.GetNpcFlag(RankFlag);
        if (stored > 0)
            return stored - 1;

        //Nobody has counted for this character yet, which is every character that existed
        //before the rank did. Counted and written down, but nothing is rebuilt from here:
        //this is reached from inside UpdateStats, and asking UpdateStats to run again from
        //the middle of itself is a mess whether or not it terminates.
        var (rank, stars) = Count(player);
        player.SetNpcFlag(RankFlag, rank + 1);
        player.SetNpcFlag(StarFlag, stars + 1);
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
        var (rank, stars) = Count(player);
        player.SetNpcFlag(StarFlag, stars + 1);

        var stored = player.GetNpcFlag(RankFlag);
        if (stored == rank + 1)
            return rank;

        //A first count is a character whose rank is being worked out for the first time
        //rather than one who has just earned it, so it pays nothing and only writes the mark.
        var isFirstCount = stored == 0;

        player.SetNpcFlag(RankFlag, rank + 1);

        //The bonuses ride on UpdateStats, so a rank that just went up is worth nothing until
        //the stats are rebuilt.
        player.UpdateStats();

        //Measured against the highest rank ever paid rather than against the rank held a
        //moment ago. The two are the same while a character is climbing; they part company
        //the first time the book's contents change under somebody, and it is the second climb
        //through the same ranks that would otherwise be paid twice.
        var paid = player.GetNpcFlag(PaidRankFlag) - 1;
        if (paid < 0)
        {
            //No mark yet: everyone from before this existed. Seeded from the rank they were
            //already cached at, so nobody is paid again for a climb they have already made.
            paid = isFirstCount ? rank : stored - 1;
        }

        if (!isFirstCount)
        {
            //Every rank actually crossed, not only the one landed on, so a character who
            //jumps two at once is not quietly shorted the one in between.
            for (var reached = paid + 1; reached <= rank; reached++)
                GiveRankReward(player, reached);
        }

        //Raised, never lowered. A rank lost to a content change stays paid for.
        if (rank > paid)
            paid = rank;
        player.SetNpcFlag(PaidRankFlag, paid + 1);

        return rank;
    }

    /// <summary>Hands over what a rank pays, and says so loudly enough to feel earned.</summary>
    private static void GiveRankReward(Player player, int rank)
    {
        var rewards = AdventureBookRewards.ForRank(rank);
        var given = new List<string>();

        foreach (var reward in rewards)
        {
            if (!DataManager.ItemIdByName.TryGetValue(reward.Code, out var itemId))
            {
                ServerLogger.LogWarning($"[AdventureBook] The rank {rank} reward '{reward.Code}' is not an item, so nothing was given.");
                continue;
            }

            player.CreateItemInInventory(new ItemReference(itemId, reward.Count));
            var itemName = DataManager.GetItemInfoById(itemId)?.Name ?? reward.Code;
            given.Add(reward.Count > 1 ? $"{itemName} x{reward.Count}" : itemName);
        }

        //Every rank, not only the last one. A rank is a week of somebody's evenings and the
        //only thing that ever said so was a line on their own screen.
        var earned = given.Count > 0 ? $" ได้รับ {string.Join(", ", given)}" : string.Empty;
        ServerAnnouncements.Announce($"ยินดีด้วย {player.Name} เลื่อนขั้นเป็น Adventure ระดับ {rank} แล้ว !{earned}");

        //The last rank is the whole point of the book, so it gets a line of its own on top.
        if (rank >= AdventureBookRank.MaxRank)
            ServerAnnouncements.Announce($"{player.Name} ทำสมุดผจญภัยครบทั้งเล่ม เป็น Adventure ระดับสูงสุด !");
    }

    private static (int Rank, int Stars) Count(Player player)
    {
        var stars = CountStars(player);
        return (AdventureBookRank.RankFor(stars, HasEveryRegion(player)), stars);
    }

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
