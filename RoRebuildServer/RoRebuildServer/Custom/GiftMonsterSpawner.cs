using RoRebuildServer.Data;
using RoRebuildServer.Data.MapData;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom;

/// <summary>
/// Puts Antonio, the Christmas santa, on every map that has monsters of its own.
///
/// He is the one who used to turn up at Christmas handing out gift boxes and stockings,
/// and here he does it all year. The point is to give somebody grinding Porings a reason
/// to look around the map, and a small chance at something they could not otherwise
/// reach. He never attacks and never fights back, he has very little health, and when he
/// dies he comes back somewhere else on the same map a few minutes later.
///
/// Spawning him from here instead of writing him into all of the spawn scripts means the
/// list of maps he appears on is always the list of maps that actually have monsters, and
/// stays right when maps are added or removed.
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

        //a map whose script spawns nothing is a town, an interior, or somewhere the player
        //is only passing through. Nothing to hunt there, so nothing to reward.
        if (config.SpawnRules.Count == 0)
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

        //No spawn area, so he can turn up anywhere the map is walkable. The boss flag is
        //not about how hard he is, it is what puts a marker on the minimap: a map is 250
        //tiles across and one wandering monster on it is not something anybody is going
        //to stumble into. He has no skills, and the flag reaches nothing else.
        config.CreateSpawn(MonsterCode, 1, RespawnTime, RespawnVariance, SpawnCreateFlags.Boss);
    }
}
