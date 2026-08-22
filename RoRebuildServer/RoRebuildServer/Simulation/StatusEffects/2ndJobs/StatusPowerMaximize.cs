using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Util;
using RoRebuildServer.Simulation.StatusEffects.Setup;

namespace RoRebuildServer.Simulation.StatusEffects._2ndJobs;

[StatusEffectHandler(CharacterStatusEffect.PowerMaximize, StatusClientVisibility.Everyone)]
public class StatusPowerMaximize : StatusEffectBase
{
    //Value1: Skill level, which doubles as the number of seconds between SP ticks
    //Value2: Seconds counted since the last SP tick

    public override StatusUpdateMode UpdateMode => StatusUpdateMode.OnPreCalculateDamageDealt | StatusUpdateMode.OnUpdate;

    public override void OnApply(CombatEntity ch, ref StatusEffectState state)
    {
        if (ch.Character.Type != CharacterType.Player)
            return;

        //Maximize Power shuts off natural SP recovery. Without this the regen tick hands
        //back several times what the drain takes, so SP climbs while the buff is up and
        //the skill never runs out - the opposite of what its description promises.
        //-999 rather than -100 so that a stacked Magnificat can't add the recovery back.
        ch.AddStat(CharacterStat.AddSpRecoveryPercent, -999);
    }

    public override void OnExpiration(CombatEntity ch, ref StatusEffectState state)
    {
        if (ch.Character.Type != CharacterType.Player)
            return;

        ch.SubStat(CharacterStat.AddSpRecoveryPercent, -999);
    }

    public override StatusUpdateResult OnUpdateTick(CombatEntity ch, ref StatusEffectState state)
    {
        if (ch.Character.Type != CharacterType.Player)
            return StatusUpdateResult.Continue;

        //OnUpdateTick runs once per second, so level 1 drains every second and level 5 every fifth.
        state.Value2++;
        if (state.Value2 >= state.Value1)
        {
            if (!ch.Player.TryTakeSpValue(1))
                return StatusUpdateResult.EndStatus;
            state.Value2 = 0;
        }

        return StatusUpdateResult.Continue;
    }

    public override StatusUpdateResult OnPreCalculateDamage(CombatEntity ch, CombatEntity? target, ref StatusEffectState state, ref AttackRequest req)
    {
        if ((req.Flags & AttackFlags.Physical) > 0 && (req.Flags & AttackFlags.NoDamageModifiers) == 0)
            req.MinAtk = req.MaxAtk;

        return StatusUpdateResult.Continue;
    }
}
