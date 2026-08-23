using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Data.Monster;
using RoRebuildServer.Data.ServerConfigScript;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom.AdventureBook;

/// <summary>
/// Builds the adventure book once the world is up, then hands it to whoever asks.
/// </summary>
/// <remarks>
/// Nothing about the book is written down by hand. The regions come from Instances.csv, the
/// monsters and their numbers from whatever spawn rules the maps actually loaded, and the
/// cards from the drop tables. Add a map to a region and its monsters appear in the book on
/// the next restart with no code touched, which is the only way a book covering hundreds of
/// monsters stays true a month from now.
///
/// Kept behind ActiveEvents so it can be switched off in appsettings.json without a rebuild,
/// the same way the milestone event is.
/// </remarks>
public class AdventureBookManager : ServerConfigScriptHandlerBase
{
    public const string EventName = "AdventureBook";

    public static bool IsEnabled { get; private set; }

    public override void PostServerStartEvent()
    {
        IsEnabled = ServerConfig.OperationConfig.ActiveEvents?.Contains(EventName) ?? false;
        if (!IsEnabled)
            return;

        try
        {
            AdventureBook.Build();
        }
        catch (Exception e)
        {
            //A book that fails to build must not take the server down with it. Everything it
            //does is additive, so a server without one is a server that plays exactly as it
            //did before, and that is a far better outcome than not starting.
            IsEnabled = false;
            ServerLogger.LogError($"[AdventureBook] Failed to build, so it is switched off for this run: {e}");
            return;
        }

        MonsterRewardManager.RegisterKillMonsterEvent(OnKillMonster);
    }

    /// <summary>
    /// Marks a kill down for everyone who helped make it.
    /// </summary>
    /// <remarks>
    /// Credit follows damage, the same rule experience already uses, rather than going to
    /// whoever landed the last hit or to the top contributor alone. A party grinding together
    /// all fill their books together, which is the behaviour worth encouraging, and standing
    /// around earns nothing because standing around deals no damage.
    ///
    /// Runs on the kill event rather than on the experience event on purpose. Experience is
    /// paid out through two different paths and the event only fires on the one for parties
    /// that share, so hooking it would have left everybody playing alone out of the book
    /// entirely - which is most of a small server, and would have looked like the counter was
    /// simply broken.
    /// </remarks>
    private void OnKillMonster(Monster monster)
    {
        if (!IsEnabled || !AdventureBook.IsBuilt)
            return;

        var damage = monster.TotalDamageReceived;
        if (damage == null || damage.Count == 0)
            return;

        if (!AdventureBook.EntriesByMonsterId.TryGetValue(monster.MonsterBase.Id, out var entry))
            return;

        var map = monster.Character.Map;

        foreach (var (attacker, _) in damage)
        {
            if (!attacker.TryGet<Player>(out var player))
                continue;
            if (player.Character.Map != map || player.Character.State == CharacterState.Dead || !player.Character.IsActive)
                continue;

            AdventureBookProgress.RecordKill(player, entry);
        }
    }
}
