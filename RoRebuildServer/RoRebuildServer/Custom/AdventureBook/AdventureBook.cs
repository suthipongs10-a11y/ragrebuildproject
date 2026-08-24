using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Logging;
using RoRebuildServer.Simulation;

namespace RoRebuildServer.Custom.AdventureBook;

/// <summary>Where something can be found, and how many of it stand there.</summary>
public readonly record struct AdventureBookSighting(string Map, int Count);

/// <summary>
/// One page. Three stars: hunt, hunt again, own the card.
/// </summary>
/// <remarks>
/// A page is a card rather than a monster. All five goblins drop the Goblin Card, the three
/// ant soldiers drop Andre's, and Fungus shares with Poison Spore - so filing them separately
/// meant a card that could only ever fill one of the pages it belonged to, and the rest of
/// them stuck one star short forever. Grouping by the card removes the collision instead of
/// working around it, and reads better besides: a hunter thinks of "goblins", not of six
/// separate monsters that happen to carry different weapons.
///
/// A monster with no card at all is its own page, worth two stars.
/// </remarks>
public class AdventureBookEntry
{
    /// <summary>
    /// What the client names when it asks about this page: the card's item id, or the
    /// monster's id when there is no card. Cards and monsters share a number range, so these
    /// are never mixed in one lookup - see AdventureBook.EntriesByPageId.
    /// </summary>
    public required int PageId { get; init; }

    /// <summary>Every monster whose death counts towards this page.</summary>
    public required int[] MonsterIds { get; init; }

    public required string Name { get; init; }

    /// <summary>
    /// What the page covers, when it covers more than one thing. Empty for an ordinary page,
    /// so a window can show "Dagger Goblin, Flail Goblin, ..." only where that is news.
    /// </summary>
    public required string Members { get; init; }

    public required int Level { get; init; }
    public required string Region { get; init; }

    /// <summary>Spawn slots everything on this page holds across every map in the world.</summary>
    public required int SpawnCount { get; init; }

    public required int HuntTarget { get; init; }
    public required int HuntTargetLarge { get; init; }

    /// <summary>The card, or 0 when there is none and the third star is out of reach.</summary>
    public required int CardItemId { get; init; }

    /// <summary>Every map it stands on, most crowded first. This is what the book offers to travel to.</summary>
    public required AdventureBookSighting[] Sightings { get; init; }

    /// <summary>
    /// The npc flag this page's progress is kept under, worked out once at startup rather
    /// than rebuilt on every kill. Every hit a player lands runs through here.
    /// </summary>
    /// <remarks>
    /// Named after the card, because the card is the one thing about a page that cannot
    /// move. The obvious choice - the lowest monster id on the page - is not stable: the
    /// page is built from the monsters standing on maps that actually loaded, so importing
    /// one more map can put a lower id on the page and rename the flag. A renamed flag is
    /// not a cosmetic problem. The old progress is orphaned, the page reads zero, and every
    /// star on it gets paid a second time.
    ///
    /// A page with no card keeps "ab" plus its monster id, which is what it always was and
    /// is stable because such a page only ever has the one monster. Card ids and monster
    /// ids overlap in the four thousands, so the carded ones take a prefix of their own
    /// rather than colliding with a monster that happens to share the number.
    /// </remarks>
    public required string ProgressFlag { get; init; }

    /// <summary>
    /// Where this page's progress used to be kept, for pages that have been renamed.
    /// </summary>
    /// <remarks>
    /// Empty for a page whose flag never moved. When it is not empty the progress under
    /// these names is merged into the current one the first time the character is seen, so
    /// that renaming the flag costs nobody their kills - and, more to the point, does not
    /// hand them their rewards again.
    /// </remarks>
    public required string[] LegacyProgressFlags { get; init; }

    public int StarCount => CardItemId > 0 ? 3 : 2;
}

public class AdventureBookRegion
{
    public required string Name { get; init; }
    public required string RewardHeadgear { get; init; }

    /// <summary>
    /// The npc flag remembering that this region's headgear has been handed over. Built from
    /// the name rather than a position in a list, so reordering the regions or adding one in
    /// the middle cannot silently point a player's record at a different place.
    /// </summary>
    public required string CompletionFlag { get; init; }

    public List<AdventureBookEntry> Entries { get; } = new();

    public int AverageLevel => Entries.Count == 0 ? 0 : (int)Entries.Average(e => e.Level);
    public int StarCount => Entries.Sum(e => e.StarCount);
    public int TotalKillsRequired => Entries.Sum(e => e.HuntTarget + e.HuntTargetLarge);
}

public static class AdventureBook
{
    public static readonly List<AdventureBookRegion> Regions = new();

    /// <summary>Every monster to the page it counts towards. Many monsters, one page.</summary>
    public static readonly Dictionary<int, AdventureBookEntry> EntriesByMonsterId = new();

    /// <summary>Card item id to the one page it fills. One card, one page, by construction.</summary>
    public static readonly Dictionary<int, AdventureBookEntry> EntriesByCardId = new();

    /// <summary>Page id to page, for a client that names one.</summary>
    public static readonly Dictionary<int, AdventureBookEntry> EntriesByPageId = new();

    public static bool IsBuilt { get; private set; }
    public static int StarTotal { get; private set; }

    /// <summary>
    /// Monsters that live everywhere, given a home by hand.
    /// </summary>
    /// <remarks>
    /// The automatic pass files a monster under whichever region holds the most of it, which
    /// is the right answer until a monster is spread thin over the whole world. Poporing
    /// stands in thirteen regions and the largest share of it is seventeen percent, so the
    /// automatic answer for those is closer to a coin toss than a decision. These are the
    /// ones worth deciding, and they are decided on where a player would say the thing
    /// belongs rather than on a count.
    /// </remarks>
    private static readonly Dictionary<string, string> RegionOverrides = new(StringComparer.OrdinalIgnoreCase)
    {
        { "PORING", "Prontera Fields" },
        { "POPORING", "Geffen Fields" },
        { "DROPS", "Morroc Fields" },
        { "MARIN", "Lutie" },
        { "POISON_SPORE", "Payon Fields" },
        { "THIEF_BUG", "Prontera Culverts" },
        { "THIEF_BUG_FEMALE", "Prontera Culverts" },
        { "THIEF_BUG_MALE", "Prontera Culverts" },
    };

    /// <summary>
    /// What finishing a region hands over. Every one of these is an item nothing else in the
    /// game can give: not a drop, not a shop, not a box, not an npc. That is the whole point
    /// of them, so before changing one, check the replacement is unobtainable too.
    /// </summary>
    private static readonly Dictionary<string, string> RegionHeadgear = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Prontera Culverts", "Detective's_Cap" },
        { "Prontera Fields", "Flower_Hairpin" },
        { "Morroc Fields", "Cowboy_Hat" },
        { "Payon Fields", "Ayam" },
        { "Ant Hell", "Novice_Eggshell" },
        { "Izlude Bailan Cave", "Bucket_Hat" },
        { "Orc Dungeon", "Orc_Helm_" },
        { "Mt. Mjolnir", "Wonder_Nutshell" },
        { "Geffen Fields", "Bulb_Band" },
        { "Mjolnir Dead Pit", "Candle" },
        { "Forest Labyrinth", "Banana_Hat" },
        { "Lutie", "Holiday_Hat" },
        { "Yuno Fields", "Ph.D_Hat_" },
        { "Payon Dungeon", "Magistrate_Hat" },
        { "Comodo", "Pirate_Dagger" },
        { "Geffen Dungeon", "Dark_Bacilium" },
        { "Sphinx", "Mythical_Lion_Mask" },
        { "Sunken Ship", "Red_Bonnet" },
        { "Pyramid", "Cross_Hat" },
        { "Clock Tower", "Golden_Gear_" },
        { "Amatsu", "Bride_Mask" },
        { "Glast Heim", "Opera_Phantom_Mask" },
        { "Magma Dungeon", "Hot-Blooded_Headband" },
        { "Turtle Island", "Spiky_Band_" },
    };

    /// <summary>Regions that exist as map groups but are not places anyone adventures.</summary>
    private static readonly HashSet<string> SkippedRegions = new(StringComparer.OrdinalIgnoreCase)
    {
        "Towns", "Debug Room", "Prontera Guild Realm"
    };

    /// <summary>
    /// How much hunting the first star asks for, from how much of it the world holds.
    /// </summary>
    /// <remarks>
    /// A flat number would have been simpler to explain but not to play: Poring holds over a
    /// thousand spawn slots and Khalitzburg fifty six, so the same target is a morning for
    /// one and a month for the other. Half the world's supply, rounded up to a round number,
    /// keeps every page roughly the same amount of hunting.
    /// </remarks>
    public static int HuntTargetForSpawnCount(int spawnCount)
    {
        var target = (spawnCount / 2 + 49) / 50 * 50;
        return Math.Clamp(target, 50, 500);
    }

    /// <summary>What one monster contributed, before anything is grouped.</summary>
    private class Gathered
    {
        public required int Id { get; init; }
        public required string Code { get; init; }
        public required string Name { get; init; }
        public required int Level { get; init; }
        public int CardItemId;
        public readonly List<AdventureBookSighting> Sightings = new();
        public readonly Dictionary<string, int> RegionCounts = new(StringComparer.OrdinalIgnoreCase);
    }

    public static void Build()
    {
        Regions.Clear();
        EntriesByMonsterId.Clear();
        EntriesByCardId.Clear();
        EntriesByPageId.Clear();
        StarTotal = 0;
        IsBuilt = false;

        //Read out of the running world rather than the spawn scripts, so the book always
        //describes the maps that actually loaded rather than the ones that were written down.
        var gathered = new Dictionary<string, Gathered>(StringComparer.OrdinalIgnoreCase);
        var bosses = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var instance in World.Instance.Instances)
        {
            foreach (var map in instance.Maps)
            {
                if (map.MapConfig.SpawnRules == null)
                    continue;

                foreach (var rule in map.MapConfig.SpawnRules)
                {
                    var monster = rule.MonsterDatabaseInfo;
                    if (monster == null || rule.Count <= 0)
                        continue;

                    if (rule.DisplayType == CharacterDisplayType.Boss || rule.DisplayType == CharacterDisplayType.Mvp)
                    {
                        //A boss is a story rather than a hunt, and the milestone event already tells it.
                        bosses.Add(monster.Code);
                        continue;
                    }

                    if (!gathered.TryGetValue(monster.Code, out var found))
                    {
                        gathered[monster.Code] = found = new Gathered
                        {
                            Id = monster.Id,
                            Code = monster.Code,
                            Name = monster.Name,
                            Level = monster.Level
                        };
                        found.CardItemId = FindCardDroppedBy(monster.Code);
                    }

                    found.Sightings.Add(new AdventureBookSighting(map.Name, rule.Count));

                    if (SkippedRegions.Contains(instance.Name))
                        continue;

                    found.RegionCounts.TryGetValue(instance.Name, out var running);
                    found.RegionCounts[instance.Name] = running + rule.Count;
                }
            }
        }

        var notQuarry = 0;
        var groups = new Dictionary<int, List<Gathered>>();

        foreach (var (code, found) in gathered)
        {
            if (bosses.Contains(code))
                continue;
            if (!DataManager.MonsterCodeLookup.TryGetValue(code, out var monster))
                continue;

            //Worth no experience means it is scenery or a training dummy rather than
            //something anybody hunts: plants, mushrooms, and the practice dummy that has a
            //hundred thousand hit points and respawns every fifteen seconds. A page asking
            //for three hundred Green Plants is not a challenge, and the dummy would have
            //been the cheapest star in the game by a wide margin.
            if (monster.Exp == 0 && monster.JobExp == 0)
            {
                notQuarry++;
                continue;
            }

            //Cards and monsters both number in the four thousands, so the two kinds of key
            //would collide in one dictionary. A monster with no card takes the negative of
            //its id, which no card can be.
            var key = found.CardItemId > 0 ? found.CardItemId : -found.Id;
            if (!groups.TryGetValue(key, out var members))
                groups[key] = members = new List<Gathered>();
            members.Add(found);
        }

        var regionLookup = new Dictionary<string, AdventureBookRegion>(StringComparer.OrdinalIgnoreCase);
        var homeless = 0;
        var merged = 0;

        foreach (var (key, members) in groups)
        {
            members.Sort((a, b) => a.Id - b.Id);

            var regionCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var mapCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var spawnCount = 0;

            foreach (var member in members)
            {
                foreach (var (region, count) in member.RegionCounts)
                {
                    regionCounts.TryGetValue(region, out var running);
                    regionCounts[region] = running + count;
                }

                foreach (var sighting in member.Sightings)
                {
                    mapCounts.TryGetValue(sighting.Map, out var running);
                    mapCounts[sighting.Map] = running + sighting.Count;
                    spawnCount += sighting.Count;
                }
            }

            var regionName = ResolveRegion(members, regionCounts);
            if (regionName == null)
            {
                homeless += members.Count;
                continue;
            }

            if (!regionLookup.TryGetValue(regionName, out var bookRegion))
            {
                if (!RegionHeadgear.TryGetValue(regionName, out var headgear))
                {
                    //A region with nothing to hand out would be a page nobody finishes.
                    ServerLogger.LogWarning($"[AdventureBook] The region '{regionName}' has monsters but no reward headgear, so it is left out of the book.");
                    homeless += members.Count;
                    continue;
                }

                regionLookup[regionName] = bookRegion = new AdventureBookRegion
                {
                    Name = regionName,
                    RewardHeadgear = headgear,
                    CompletionFlag = "abr" + regionName.Replace(" ", "").Replace(".", "")
                };
            }

            var cardId = key > 0 ? key : 0;
            var target = HuntTargetForSpawnCount(spawnCount);
            if (members.Count > 1)
                merged += members.Count;

            var entry = new AdventureBookEntry
            {
                PageId = key > 0 ? key : members[0].Id,
                MonsterIds = members.Select(m => m.Id).ToArray(),
                Name = PageName(members, cardId),
                Members = members.Count > 1 ? string.Join(", ", members.Select(m => m.Name)) : string.Empty,
                Level = (int)members.Average(m => m.Level),
                Region = regionName,
                SpawnCount = spawnCount,
                HuntTarget = target,
                HuntTargetLarge = target * 3,
                CardItemId = cardId,
                Sightings = mapCounts
                    .Select(kv => new AdventureBookSighting(kv.Key, kv.Value))
                    .OrderByDescending(s => s.Count)
                    .ToArray(),

                //Named after the card rather than after whichever monster happens to have the
                //lowest id today - see the remarks on the field. A page with no card keeps
                //the name it always had.
                ProgressFlag = cardId > 0 ? "abc" + cardId : "ab" + members[0].Id,

                //Every name this page's progress could be sitting under from before the flag
                //was named after the card. Only carded pages ever moved.
                LegacyProgressFlags = cardId > 0
                    ? members.Select(m => "ab" + m.Id).ToArray()
                    : Array.Empty<string>()
            };

            bookRegion.Entries.Add(entry);
            EntriesByPageId[entry.PageId] = entry;

            foreach (var id in entry.MonsterIds)
                EntriesByMonsterId[id] = entry;

            if (entry.CardItemId > 0)
                EntriesByCardId[entry.CardItemId] = entry;
        }

        foreach (var region in regionLookup.Values)
        {
            region.Entries.Sort((a, b) => a.Level != b.Level ? a.Level - b.Level : string.CompareOrdinal(a.Name, b.Name));
            Regions.Add(region);
        }

        Regions.Sort((a, b) => a.AverageLevel - b.AverageLevel);
        StarTotal = Regions.Sum(r => r.StarCount);
        IsBuilt = Regions.Count > 0;

        VerifyRewards();
        LogSummary(homeless, notQuarry, merged);
    }

    /// <summary>
    /// What to call a page.
    /// </summary>
    /// <remarks>
    /// One monster keeps its own name, which is what somebody looking for it will search for.
    /// A page covering several is named after the card that binds them, with the word Card
    /// taken off the end - "Goblin Card" becomes "Goblin", which is what a hunter would have
    /// called the group anyway. The member names go on the page as well, so nobody has to
    /// guess whether Festive Goblin is in there.
    /// </remarks>
    private static string PageName(List<Gathered> members, int cardId)
    {
        if (members.Count == 1)
            return members[0].Name;

        var card = cardId > 0 ? DataManager.GetItemInfoById(cardId)?.Name : null;
        if (string.IsNullOrWhiteSpace(card))
            return members[0].Name;

        const string suffix = " Card";
        if (card.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            card = card[..^suffix.Length];

        return string.IsNullOrWhiteSpace(card) ? members[0].Name : card;
    }

    private static string? ResolveRegion(List<Gathered> members, Dictionary<string, int> counts)
    {
        //A hand written home wins, and any member carrying one speaks for the whole page -
        //the override table names monsters, and a page can be several of them.
        foreach (var member in members)
        {
            if (!RegionOverrides.TryGetValue(member.Code, out var chosen))
                continue;

            if (RegionHeadgear.ContainsKey(chosen))
                return chosen;

            ServerLogger.LogWarning($"[AdventureBook] {member.Code} is assigned by hand to '{chosen}', which is not a region in the book. Falling back to where it spawns most.");
        }

        if (counts.Count == 0)
            return null;

        var best = string.Empty;
        var bestCount = -1;
        foreach (var (region, count) in counts)
        {
            if (count <= bestCount)
                continue;
            best = region;
            bestCount = count;
        }

        return best.Length == 0 ? null : best;
    }

    private static int FindCardDroppedBy(string code)
    {
        if (!DataManager.MonsterDropData.TryGetValue(code, out var drops))
            return 0;

        foreach (var drop in drops.DropChances)
        {
            var item = DataManager.GetItemInfoById(drop.Id);
            if (item != null && item.ItemClass == ItemClass.Card)
                return item.Id;
        }

        return 0;
    }

    /// <summary>
    /// Shouts about a reward that does not exist, at startup rather than at the moment a
    /// player finishes a region they spent a week on and receives nothing.
    /// </summary>
    private static void VerifyRewards()
    {
        foreach (var region in Regions)
        {
            if (DataManager.ItemIdByName.ContainsKey(region.RewardHeadgear))
                continue;

            ServerLogger.LogError($"[AdventureBook] The reward for '{region.Name}' is '{region.RewardHeadgear}', which is not an item. "
                                  + "Finishing that region will hand over nothing.");
        }
    }

    private static void LogSummary(int homeless, int notQuarry, int merged)
    {
        if (!IsBuilt)
        {
            ServerLogger.LogWarning("[AdventureBook] No regions were built. The book is empty.");
            return;
        }

        var entries = Regions.Sum(r => r.Entries.Count);
        var kills = Regions.Sum(r => r.TotalKillsRequired);
        var cardless = Regions.Sum(r => r.Entries.Count(e => e.CardItemId == 0));

        ServerLogger.Log($"[AdventureBook] {entries} pages across {Regions.Count} regions, {StarTotal} stars, {kills:N0} kills to fill it.");
        if (merged > 0)
            ServerLogger.Log($"[AdventureBook] {merged} monsters share a card with something else and are grouped onto {CountMergedPages()} pages between them.");
        if (cardless > 0)
            ServerLogger.Log($"[AdventureBook] {cardless} pages drop no card, so they are worth two stars rather than three.");
        if (homeless > 0)
            ServerLogger.Log($"[AdventureBook] {homeless} monsters were left out because their maps belong to no region in the book.");
        if (notQuarry > 0)
            ServerLogger.Log($"[AdventureBook] {notQuarry} were left out for being worth no experience - plants, mushrooms and training dummies.");

        foreach (var region in Regions)
        {
            ServerLogger.Log($"[AdventureBook]   {region.Name,-22} {region.Entries.Count,3} pages  avg lv {region.AverageLevel,3}  "
                             + $"{region.StarCount,3} stars  {region.TotalKillsRequired,7:N0} kills  reward {region.RewardHeadgear}");
        }
    }

    private static int CountMergedPages()
    {
        var count = 0;
        foreach (var (_, entry) in EntriesByPageId)
            if (entry.MonsterIds.Length > 1)
                count++;

        return count;
    }
}
