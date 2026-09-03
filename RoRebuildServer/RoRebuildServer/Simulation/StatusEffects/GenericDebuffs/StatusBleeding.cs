using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Character;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.StatusEffects.Setup;

namespace RoRebuildServer.Simulation.StatusEffects.GenericDebuffs;

/// <summary>
/// Bleeding: a wound that keeps costing, and that will not close on its own.
/// </summary>
/// <remarks>
/// Built on the same bones as poison and different from it in the two ways that matter.
/// It ticks every ten seconds rather than every three, so each tick is a real bite rather
/// than a trickle, and it stops natural recovery entirely instead of only the sp: the
/// point of bleeding is that sitting down does nothing for it.
///
/// Value1 is who caused it, so they get the kill if it lands one. Value2 is the damage per
/// tick, fixed when it was inflicted. Value4 counts the seconds down to the next tick.
/// </remarks>
[StatusEffectHandler(CharacterStatusEffect.Bleeding, StatusClientVisibility.Everyone)]
public class StatusBleeding : StatusEffectBase
{
    private const int TickSeconds = 10;

    public override StatusUpdateMode UpdateMode => StatusUpdateMode.OnUpdate;

    public override StatusUpdateResult OnUpdateTick(CombatEntity ch, ref StatusEffectState state)
    {
        state.Value4--;
        if (state.Value4 > 0)
            return StatusUpdateResult.Continue;
        state.Value4 = TickSeconds;

        var attackerEntity = World.Instance.GetEntityById(state.Value1);
        if (!attackerEntity.TryGet<CombatEntity>(out var attacker))
            attacker = ch;

        var damage = GameRandom.Next(state.Value2 * 90 / 100, state.Value2 * 110 / 100 + 1);
        if (ch.Character.Type == CharacterType.Player)
        {
            //players are bled down to one hp and left there, the way poison leaves them
            var remainingHp = ch.GetStat(CharacterStat.Hp);
            if (damage > remainingHp)
                damage = remainingHp - 1;
        }

        if (damage <= 0)
            return StatusUpdateResult.Continue;

        var di = new DamageInfo()
        {
            Damage = damage,
            Result = AttackResult.NormalDamage,
            KnockBack = 0,
            Source = attacker.Entity,
            Target = ch.Entity,
            AttackSkill = CharacterSkill.NoCast,
            HitCount = 1,
            Time = 0,
            AttackMotionTime = 0,
            AttackPosition = ch.Character.Position,
            Flags = DamageApplicationFlags.NoHitLock | DamageApplicationFlags.SkipOnHitTriggers | DamageApplicationFlags.PhysicalDamage
        };

        ch.ExecuteCombatResult(di, false, false);

        ch.Character.Map?.AddVisiblePlayersAsPacketRecipients(ch.Character);
        CommandBuilder.AttackMulti(null, ch.Character, di, false);
        CommandBuilder.ClearRecipients();

        return StatusUpdateResult.Continue;
    }

    public override void OnApply(CombatEntity ch, ref StatusEffectState state)
    {
        state.Value4 = TickSeconds;
        ch.AddStat(CharacterStat.AddHpRecoveryPercent, -999);
        ch.AddStat(CharacterStat.AddSpRecoveryPercent, -999);
    }

    public override void OnExpiration(CombatEntity ch, ref StatusEffectState state)
    {
        ch.SubStat(CharacterStat.AddHpRecoveryPercent, -999);
        ch.SubStat(CharacterStat.AddSpRecoveryPercent, -999);
    }
}
