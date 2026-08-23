using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Logging;
using RoRebuildServer.Simulation;

namespace RoRebuildServer.Custom.AdventureBook;

/// <summary>Where a monster can be found, and how many of it stand there.</summary>
public readonly record struct AdventureBookSighting(string Map, int Count);

/// <summary>One monster's page. Three stars: hunt, hunt again, own its card.</summary>
public class AdventureBookEntry
{
    public required int MonsterId { get; init; }
    public required string Code { get; init; }
    public required string Name { get; init; }
    public required int Level { get; init; }
    public required string Region { get; init; }

    /// <summary>Spawn slots this monster holds across every map in the world.</summary>
    public required int SpawnCount { get; init; }

    public required int HuntTarget { get; init; }
    public required int HuntTargetLarge { get; init; }

    /// <summary>The card this monster drops, or 0 when it has none and the third star is out of reach.</summary>
    public required int CardItemId { get; init; }

    /// <summary>Every map it stands on, most crowded first. This is what the book offers to travel to.</summary>
    public required AdventureBookSighting[] Sightings { get; init; }

    /// <summary>
    /// The npc flag this monster's progress is kept under, worked out once at startup rather
    /// than rebuilt on every kill. Every hit a player lands runs through here.
    /// </summary>
    public required string ProgressFlag { get; init; }

    public int StarCount => CardItemId > 0 ? 3 : 2;
}

public class AdventureBookRegion
{
    public required string Name { get; init; }
    public required string RewardHeadgear { get; init; }
    public List<AdventureBookEntry> Entries { get; } = new();

    public int AverageLevel => Entries.Count == 0 ? 0 : (int)Entries.Average(e => e.Level);
    public int StarCount => Entries.Sum(e => e.StarCount);
    public int TotalKillsRequired => Entries.Sum(e => e.HuntTarget + e.HuntTargetLarge);
}

public static class AdventureBook
{
    public static readonly List<AdventureBookRegion> Regions = new();
    public static readonly Dictionary<int, AdventureBookEntry> EntriesByMonsterId = new();

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
    /// How many of a monster the first star asks for, from how much of it the world holds.
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

    public static void Build()
    {
        Regions.Clear();
        EntriesByMonsterId.Clear();
        StarTotal = 0;
        IsBuilt = false;

        //Read out of the running world rather than the spawn scripts, so the book always
        //describes the maps that actually loaded rather than the ones that were written down.
        var sightings = new Dictionary<string, List<AdventureBookSighting>>(StringComparer.OrdinalIgnoreCase);
        var regionCounts = new Dictionary<string, Dictionary<string, int>>(StringComparer.OrdinalIgnoreCase);
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

                    if (!sightings.TryGetValue(monster.Code, out var seen))
                        sightings[monster.Code] = seen = new List<AdventureBookSighting>();
                    seen.Add(new AdventureBookSighting(map.Name, rule.Count));

                    if (SkippedRegions.Contains(instance.Name))
                        continue;

                    if (!regionCounts.TryGetValue(monster.Code, out var counts))
                        regionCounts[monster.Code] = counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                    counts.TryGetValue(instance.Name, out var running);
                    counts[instance.Name] = running + rule.Count;
                }
            }
        }

        var regionLookup = new Dictionary<string, AdventureBookRegion>(StringComparer.OrdinalIgnoreCase);
        var homeless = 0;
        var notQuarry = 0;

        foreach (var (code, counts) in regionCounts)
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

            var region = ResolveRegion(code, counts);
            if (region == null)
            {
                homeless++;
                continue;
            }

            if (!regionLookup.TryGetValue(region, out var bookRegion))
            {
                if (!RegionHeadgear.TryGetValue(region, out var headgear))
                {
                    //A region with nothing to hand out would be a page nobody finishes.
                    ServerLogger.LogWarning($"[AdventureBook] The region '{region}' has monsters but no reward headgear, so it is left out of the book.");
                    homeless++;
                    continue;
                }

                regionLookup[region] = bookRegion = new AdventureBookRegion { Name = region, RewardHeadgear = headgear };
            }

            var spawnCount = sightings.TryGetValue(code, out var seen) ? seen.Sum(s => s.Count) : 0;
            var target = HuntTargetForSpawnCount(spawnCount);

            var entry = new AdventureBookEntry
            {
                MonsterId = monster.Id,
                Code = monster.Code,
                Name = monster.Name,
                Level = monster.Level,
                Region = region,
                SpawnCount = spawnCount,
                HuntTarget = target,
                HuntTargetLarge = target * 3,
                CardItemId = FindCardDroppedBy(code),
                Sightings = seen == null
                    ? Array.Empty<AdventureBookSighting>()
                    : seen.OrderByDescending(s => s.Count).ToArray(),
                ProgressFlag = "ab" + monster.Id
            };

            bookRegion.Entries.Add(entry);
            EntriesByMonsterId[entry.MonsterId] = entry;
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
        LogSummary(homeless, notQuarry);
    }

    private static string? ResolveRegion(string code, Dictionary<string, int> counts)
    {
        if (RegionOverrides.TryGetValue(code, out var chosen))
        {
            if (RegionHeadgear.ContainsKey(chosen))
                return chosen;

            ServerLogger.LogWarning($"[AdventureBook] {code} is assigned by hand to '{chosen}', which is not a region in the book. Falling back to where it spawns most.");
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

    private static void LogSummary(int homeless, int notQuarry)
    {
        if (!IsBuilt)
        {
            ServerLogger.LogWarning("[AdventureBook] No regions were built. The book is empty.");
            return;
        }

        var entries = Regions.Sum(r => r.Entries.Count);
        var kills = Regions.Sum(r => r.TotalKillsRequired);
        var cardless = Regions.Sum(r => r.Entries.Count(e => e.CardItemId == 0));

        ServerLogger.Log($"[AdventureBook] {entries} monsters across {Regions.Count} regions, {StarTotal} stars, {kills:N0} kills to fill it.");
        if (cardless > 0)
            ServerLogger.Log($"[AdventureBook] {cardless} of those drop no card, so they are worth two stars rather than three.");
        if (homeless > 0)
            ServerLogger.Log($"[AdventureBook] {homeless} monsters were left out because their maps belong to no region in the book.");
        if (notQuarry > 0)
            ServerLogger.Log($"[AdventureBook] {notQuarry} were left out for being worth no experience - plants, mushrooms and training dummies.");

        foreach (var region in Regions)
        {
            ServerLogger.Log($"[AdventureBook]   {region.Name,-22} {region.Entries.Count,3} monsters  avg lv {region.AverageLevel,3}  "
                             + $"{region.StarCount,3} stars  {region.TotalKillsRequired,7:N0} kills  reward {region.RewardHeadgear}");
        }
    }
}
