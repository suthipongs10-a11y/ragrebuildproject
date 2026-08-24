using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Data.Monster;
using RoRebuildServer.Data.ServerConfigScript;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom.BossLog;

/// <summary>
/// Builds the boss log once the world is up and marks kills down against it.
/// </summary>
/// <remarks>
/// Behind the same ActiveEvents switch the adventure book is, and off by default for the same
/// reason: everything it does is additive, so a server without it plays exactly as it did.
/// </remarks>
public class BossLogManager : ServerConfigScriptHandlerBase
{
    public const string EventName = "BossLog";

    public static bool IsEnabled { get; private set; }

    /// <summary>
    /// The share of a boss's damage that counts as having fought it, in percent.
    /// </summary>
    /// <remarks>
    /// The two obvious rules are both wrong. Credit only the top contributor and a party of
    /// five is four people wasting an evening, so nobody helps anybody. Credit everybody who
    /// landed a hit and one arrow from across the map is a boss in your log, which makes the
    /// whole thing worthless.
    ///
    /// A tenth of the damage is a real share of a real fight. A party of five splitting it
    /// evenly all clear it twice over; somebody passing through does not.
    /// </remarks>
    private const int CreditDamagePercent = 10;

    public override void PostServerStartEvent()
    {
        IsEnabled = ServerConfig.OperationConfig.ActiveEvents?.Contains(EventName) ?? false;
        if (!IsEnabled)
            return;

        try
        {
            BossLog.Build();
        }
        catch (Exception e)
        {
            IsEnabled = false;
            ServerLogger.LogError($"[BossLog] Failed to build, so it is switched off for this run: {e}");
            return;
        }

        MonsterRewardManager.RegisterKillMonsterEvent(OnKillMonster);
    }

    private void OnKillMonster(Monster monster)
    {
        if (!IsEnabled || !BossLog.IsBuilt)
            return;

        var damage = monster.TotalDamageReceived;
        if (damage == null || damage.Count == 0)
            return;

        if (!BossLog.EntriesByMonsterId.TryGetValue(monster.MonsterBase.Id, out var entry))
            return;

        var map = monster.Character.Map;

        var total = 0;
        foreach (var (_, dealt) in damage)
            total += dealt;

        if (total <= 0)
            return;

        var threshold = total * CreditDamagePercent / 100;

        foreach (var (attacker, dealt) in damage)
        {
            if (dealt < threshold)
                continue;
            if (!attacker.TryGet<Player>(out var player))
                continue;
            if (player.Character.Map != map || player.Character.State == CharacterState.Dead || !player.Character.IsActive)
                continue;

            BossLogProgress.RecordKill(player, entry);
        }
    }
}
