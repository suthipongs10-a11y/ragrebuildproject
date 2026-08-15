using RoRebuildServer.Data;
using RoRebuildServer.Data.MapData;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom;

/// <summary>
/// Puts one harmless gift monster on every map that has monsters of its own.
///
/// The point is to give somebody grinding Porings a reason to look around the map, and a
/// small chance at something they could not otherwise reach. It never attacks and never
/// fights back, it has very little health, and when it dies it comes back somewhere else
/// on the same map a few minutes later.
///
/// Spawning it from here instead of writing it into all of the spawn scripts means the
/// list of maps it appears on is always the list of maps that actually have monsters, and
/// stays right when maps are added or removed.
/// </summary>
public static class GiftMonsterSpawner
{
    /// <summary>The row added to Monsters.csv. AiPacifist is what makes it harmless.</summary>
    private const string MonsterCode = "GIFT_PORING";

    /// <summary>
    /// Three to six minutes after it dies. Long enough that finding one feels like luck,
    /// short enough that a map is rarely without one. Note the server clamps this against
    /// MinSpawnTime/MaxSpawnTime in ServerDebugConfig.
    /// </summary>
    private const int RespawnTime = 180000;

    private const int RespawnVariance = 180000;

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
                ServerLogger.LogWarning($"Gift monsters are enabled but '{MonsterCode}' is not in the monster database. No gift monsters will spawn.");
            }

            return;
        }

        //no spawn area, so it can turn up anywhere the map is walkable
        config.CreateSpawn(MonsterCode, 1, RespawnTime, RespawnVariance);
    }
}
