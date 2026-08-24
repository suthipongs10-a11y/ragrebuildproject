using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Simulation.StatusEffects.Setup;

namespace RoRebuildServer.Simulation.StatusEffects.ItemEffects;

/// <summary>
/// Battle Manual and Bubble Gum: double experience, and double the chance of a drop.
/// </summary>
/// <remarks>
/// Both items have existed in the item tables since the beginning and neither could be used -
/// they sat in ItemEffects.txt as "OnValidate: return false", which is a stub saying the item
/// exists and does nothing. The stats they need were already wired: AddExpPercent is read when
/// experience is handed out and AddDropPercent when a drop is rolled, both by the monster.
///
/// A hundred percent rather than a multiplier because that is what those two stats mean - the
/// monster adds the percentage to what it was going to give, so a hundred is twice as much.
///
/// They do not share a group. Somebody who wants both at once has spent both, and the two
/// measure different things.
/// </remarks>
[StatusEffectHandler(CharacterStatusEffect.BattleManual, StatusClientVisibility.Owner)]
[StatusEffectHandler(CharacterStatusEffect.BubbleGum, StatusClientVisibility.Owner)]
public class StatusRateBoost : StatusEffectBase
{
    private static CharacterStat StatFor(CharacterStatusEffect type) =>
        type == CharacterStatusEffect.BattleManual ? CharacterStat.AddExpPercent : CharacterStat.AddDropPercent;

    public override void OnApply(CombatEntity ch, ref StatusEffectState state)
    {
        if (ch.Character.Type != CharacterType.Player)
            return;

        //Written down rather than assumed, so a change to the figure later cannot leave an
        //already running buff subtracting something it never added.
        state.Value1 = 100;
        ch.AddStat(StatFor(state.Type), state.Value1);
    }

    public override void OnExpiration(CombatEntity ch, ref StatusEffectState state)
    {
        if (ch.Character.Type != CharacterType.Player)
            return;

        ch.SubStat(StatFor(state.Type), state.Value1);
    }
}
