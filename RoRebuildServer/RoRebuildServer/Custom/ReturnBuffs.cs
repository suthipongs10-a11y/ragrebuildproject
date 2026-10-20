using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.StatusEffects.Setup;

namespace RoRebuildServer.Custom;

/// <summary>
/// What a player is handed for pressing the button that sends them back to their save
/// point: a full health bar and the two buffs every character wants and not every
/// character has a priest standing next to them for, Blessing and Increase AGI.
/// </summary>
/// <remarks>
/// "The button" is both ways a player can ask for the trip themselves - Respawn after
/// dying, and Return to Save Point in the escape menu, which works while alive. A
/// butterfly wing, the Return skill and the server moving somebody off a closing map are
/// all the same trip made for other reasons, and none of them calls this: a wing costs a
/// wing, and nobody should be paid for being evicted.
///
/// The buffs are the ordinary status effects, added the way the skills add them, so they
/// show up in the buff bar with their icon and timer, can be cancelled from it, and are
/// dispelled like any other. Nothing on the client knows this exists.
///
/// ServerOperationConfig.ReturnBuffMinutes says how long they last; zero turns all of it
/// off, the refill included.
/// </remarks>
public static class ReturnBuffs
{
    /// <summary>
    /// The buffs given, each with the skill level it stands for. Both of these keep their
    /// level in the first value of the status, which is what the line in Give assumes - a
    /// buff that wants something else there needs its own line.
    /// </summary>
    private static readonly (CharacterStatusEffect Status, int Level)[] Buffs =
    {
        (CharacterStatusEffect.Blessing, 10),
        (CharacterStatusEffect.IncreaseAgi, 10),
    };

    /// <summary>
    /// Fills the player's HP and puts the buffs on them. Called just before the trip is
    /// made rather than after it: the move to another map reads the HP and the status list
    /// back out, for the party window now and for the client when it finishes loading, so
    /// they have to be in place by then.
    /// </summary>
    public static void Give(Player player)
    {
        var minutes = ServerConfig.OperationConfig.ReturnBuffMinutes;
        if (minutes <= 0)
            return;

        //a dead character cannot be given a status, and has no business being here either
        if (player.Character.State == CharacterState.Dead)
            return;

        var ce = player.CombatEntity;

        //Told to the player as a heal as well as set: it is what moves the HP bar on the
        //HUD, and when the save point is on the map they are already standing on there is
        //no map load to carry the new number in its place.
        var maxHp = ce.GetStat(CharacterStat.MaxHp);
        var missing = maxHp - ce.GetStat(CharacterStat.Hp);
        if (missing > 0)
        {
            ce.SetStat(CharacterStat.Hp, maxHp);
            CommandBuilder.SendHealSingle(player, missing, HealType.None);
        }

        //the same refusal the two skills make: neither can be cast on an undead player
        if (ce.IsElementBaseType(CharacterElement.Undead1))
            return;

        var seconds = minutes * 60f;
        foreach (var (status, level) in Buffs)
            ce.AddStatusEffect(StatusEffectState.NewStatusEffect(status, seconds, level));
    }
}
