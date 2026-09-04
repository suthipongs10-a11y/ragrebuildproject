using RoRebuildServer.Data;
using RoRebuildServer.Data.MapData;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom;

/// <summary>
/// Puts Antonio, the Christmas santa, on every map there is.
///
/// He is the one who used to turn up at Christmas handing out gift boxes and stockings,
/// and here he does it all year. The point is to give somebody grinding Porings a reason
/// to look around the map, and a small chance at something they could not otherwise
/// reach. He never attacks and never fights back, he has very little health, and when he
/// dies he comes back somewhere else on the same map a minute later.
///
/// Every map, towns and interiors included. He used to keep to maps with monsters of
/// their own, on the thought that a town had nothing to hunt; but a santa wandering the
/// streets of Prontera or standing in somebody's kitchen is the whole joke, and nothing
/// in the rules stops a monster being killed in a town. Spawning him from here instead of
/// writing him into all of the spawn scripts means no map can be forgotten when maps are
/// added or removed.
/// </summary>
public static class GiftMonsterSpawner
{
    /// <summary>The row added to Monsters.csv. AiPacifist is what makes him harmless.</summary>
    private const string MonsterCode = "ANTONIO";

    /// <summary>
    /// A minute after he dies. He is a giveaway rather than a prize, so the map is meant
    /// to have one nearly all of the time. Note the server clamps this against
    /// MinSpawnTime/MaxSpawnTime in ServerDebugConfig.
    /// </summary>
    private const int RespawnTime = 60000;

    private const int RespawnVariance = 0;

    private static bool warnedMissing;

    /// <summary>
    /// Called for each map once its own spawn script has run, before those spawns are
    /// turned into live monsters.
    /// </summary>
    public static void AddToMap(IServerMapConfig config)
    {
        if (!ServerConfig.OperationConfig.SpawnGiftMonsters)
            return;

        if (!DataManager.MonsterCodeLookup.ContainsKey(MonsterCode))
        {
            if (!warnedMissing)
            {
                warnedMissing = true;
                ServerLogger.LogWarning($"Gift monsters are enabled but '{MonsterCode}' is not in the monster database. Antonio will not spawn anywhere.");
            }

            return;
        }

        //No spawn area, so he can turn up anywhere the map is walkable. No boss flag
        //either: the flag is not about how hard he is, it is what puts a marker on the
        //minimap, and he used to carry it so that one wandering monster on a map 250
        //tiles across could be found at all. That marker turned finding him from a
        //stroke of luck into a job - the stockings he drops are worth something now, and
        //a santa everybody can see on the map is a santa somebody farms for a living. He
        //has no skills, so the flag reached nothing else and nothing else changes.
        config.CreateSpawn(MonsterCode, 1, RespawnTime, RespawnVariance);
    }
}
