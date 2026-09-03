using RebuildSharedData.Enum;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Character;
using RoRebuildServer.Simulation.StatusEffects.Setup;

namespace RoRebuildServer.Simulation.StatusEffects.GenericDebuffs;

/// <summary>
/// Confusion: the legs stop taking orders.
/// </summary>
/// <remarks>
/// The status itself only raises a body flag. What the flag does lives in WorldObject.TryMove,
/// which is the one place every walk in the game passes through, so a confused player's
/// click and a confused monster's chase are both answered the same way: the destination is
/// swapped for a random cell nearby. That is the whole effect and it is enough - a monster
/// that cannot close is a monster that is not hitting you.
/// </remarks>
[StatusEffectHandler(CharacterStatusEffect.Confusion, StatusClientVisibility.Everyone)]
public class StatusConfusion : StatusEffectBase
{
    public override void OnApply(CombatEntity ch, ref StatusEffectState state) =>
        ch.SetBodyState(BodyStateFlags.Confusion);

    public override void OnExpiration(CombatEntity ch, ref StatusEffectState state) =>
        ch.RemoveBodyState(BodyStateFlags.Confusion);
}
