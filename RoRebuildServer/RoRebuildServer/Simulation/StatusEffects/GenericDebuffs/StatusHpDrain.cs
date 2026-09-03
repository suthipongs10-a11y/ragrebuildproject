using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Character;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.StatusEffects.Setup;

namespace RoRebuildServer.Simulation.StatusEffects.GenericDebuffs;

/// <summary>
/// A fixed bite of hp on a fixed clock, for as long as it is on you.
/// </summary>
/// <remarks>
/// A cursed piece of equipment needs a way to keep taking, and a card's OnEquip runs once.
/// This is the timer: Value1 is how much, Value2 is how often in seconds, Value4 counts
/// down to the next one. It is put on by the card and taken off by the card, and nothing
/// else touches it. It never kills - down to one hp and no further - because a weapon that
/// executes its own wielder while they are away from the keyboard is a bug report, not a
/// curse.
/// </remarks>
[StatusEffectHandler(CharacterStatusEffect.HpDrain, StatusClientVisibility.Owner, StatusEffectFlags.NoSave)]
public class StatusHpDrain : StatusEffectBase
{
    public override StatusUpdateMode UpdateMode => StatusUpdateMode.OnUpdate;

    public override StatusUpdateResult OnUpdateTick(CombatEntity ch, ref StatusEffectState state)
    {
        state.Value4--;
        if (state.Value4 > 0)
            return StatusUpdateResult.Continue;
        state.Value4 = (byte)int.Clamp(state.Value2, 1, 255);

        var damage = state.Value1;
        var remainingHp = ch.GetStat(CharacterStat.Hp);
        if (damage >= remainingHp)
            damage = remainingHp - 1;
        if (damage <= 0)
            return StatusUpdateResult.Continue;

        var di = new DamageInfo()
        {
            Damage = damage,
            Result = AttackResult.NormalDamage,
            Source = ch.Entity,
            Target = ch.Entity,
            AttackSkill = CharacterSkill.NoCast,
            HitCount = 1,
            AttackPosition = ch.Character.Position,
            Flags = DamageApplicationFlags.NoHitLock | DamageApplicationFlags.SkipOnHitTriggers
        };

        ch.ExecuteCombatResult(di, false, false);

        ch.Character.Map?.AddVisiblePlayersAsPacketRecipients(ch.Character);
        CommandBuilder.AttackMulti(null, ch.Character, di, false);
        CommandBuilder.ClearRecipients();

        return StatusUpdateResult.Continue;
    }

    public override void OnApply(CombatEntity ch, ref StatusEffectState state) =>
        state.Value4 = (byte)int.Clamp(state.Value2, 1, 255);
}
