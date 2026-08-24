using RebuildSharedData.Enum;
using RoRebuildServer.Custom.AdventureBook;
using RoRebuildServer.Logging;
using RoRebuildServer.Simulation;

namespace RoRebuildServer.Custom.BossLog;

/// <summary>
/// One thing in the log: a boss, and where it stands.
/// </summary>
public class BossLogEntry
{
    public required int MonsterId { get; init; }
    public required string Code { get; init; }
    public required string Name { get; init; }
    public required int Level { get; init; }

    /// <summary>An MVP rather than a mini boss. Only these roll for the crowned hat.</summary>
    public required bool IsMvp { get; init; }

    public required AdventureBookSighting[] Sightings { get; init; }

    /// <summary>The npc flag this entry's kill count lives under.</summary>
    public required string ProgressFlag { get; init; }
}

/// <summary>
/// The boss hunter's log: every MVP and mini boss in the world, and whether you have met it.
/// </summary>
/// <remarks>
/// A companion to the adventure book rather than part of it. The book counts hunting, which
/// is a thing you do for an hour; this counts bosses, which respawn once an hour and are a
/// thing you plan an evening around. Mixing them would have meant either a page asking for
/// fifty Baphomets or an adventure rank that a boss hunter could climb without hunting, and
/// neither is the game either half is trying to be.
///
/// Nothing here feeds the adventure rank. The log pays its own two prizes and stops.
///
/// Built from the spawn rules of the maps that actually loaded, the same way the book is, so
/// importing a map adds its bosses on the next restart with no code touched.
/// </remarks>
public static class BossLog
{
    public static readonly List<BossLogEntry> Entries = new();
    public static readonly Dictionary<int, BossLogEntry> EntriesByMonsterId = new();

    public static bool IsBuilt { get; private set; }

    /// <summary>How many of them there are, which is what finishing the log asks for.</summary>
    public static int Total => Entries.Count;

    public static int MvpCount { get; private set; }

    private class Gathered
    {
        public required int Id { get; init; }
        public required string Code { get; init; }
        public required string Name { get; init; }
        public required int Level { get; init; }
        public bool IsMvp;
        public readonly List<AdventureBookSighting> Sightings = new();
    }

    public static void Build()
    {
        Entries.Clear();
        EntriesByMonsterId.Clear();
        MvpCount = 0;
        IsBuilt = false;

        var gathered = new Dictionary<string, Gathered>(StringComparer.OrdinalIgnoreCase);

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

                    var isMvp = rule.DisplayType == CharacterDisplayType.Mvp;
                    if (!isMvp && rule.DisplayType != CharacterDisplayType.Boss)
                        continue;

                    if (!gathered.TryGetValue(monster.Code, out var found))
                    {
                        gathered[monster.Code] = found = new Gathered
                        {
                            Id = monster.Id,
                            Code = monster.Code,
                            Name = monster.Name,
                            Level = monster.Level
                        };
                    }

                    //A monster spawned as a boss on one map and an mvp on another counts as
                    //the mvp, which is the harder of the two to go and find.
                    found.IsMvp |= isMvp;
                    found.Sightings.Add(new AdventureBookSighting(map.Name, rule.Count));
                }
            }
        }

        foreach (var found in gathered.Values.OrderByDescending(g => g.IsMvp).ThenBy(g => g.Level))
        {
            var entry = new BossLogEntry
            {
                MonsterId = found.Id,
                Code = found.Code,
                Name = found.Name,
                Level = found.Level,
                IsMvp = found.IsMvp,
                Sightings = found.Sightings.ToArray(),

                //Named after the monster, which cannot move. There is one entry per monster
                //here rather than per card, so there is no grouping to drift.
                ProgressFlag = "bl" + found.Id
            };

            Entries.Add(entry);
            EntriesByMonsterId[entry.MonsterId] = entry;

            if (entry.IsMvp)
                MvpCount++;
        }

        IsBuilt = true;
        ServerLogger.Log($"[BossLog] Built with {Entries.Count} boss(es), of which {MvpCount} are MVPs.");
    }
}
