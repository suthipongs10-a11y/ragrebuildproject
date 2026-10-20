using System.Diagnostics;
using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Character;
using RoRebuildServer.EntityComponents.Util;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Simulation.Skills.SkillHandlers.Wizard;

[SkillHandler(CharacterSkill.FrostNova, SkillClass.Magic, SkillTarget.Self)]
public class FrostNovaHandler : SkillHandlerBase
{
    private const int BlastDistance = 2; //2 tiles out from the caster = 5x5

    //6 seconds at level 1 down to 4 seconds at level 10, half a second shorter every second level
    public override float GetCastTime(CombatEntity source, CombatEntity? target, Position position, int lvl) =>
        6f - 0.5f * ((int.Clamp(lvl, 1, 10) - 1) / 2);

    public override void Process(CombatEntity source, CombatEntity? target, Position position, int lvl, bool isIndirect, bool isItemSource)
    {
        var map = source.Character.Map;
        Debug.Assert(map != null);

        lvl = int.Clamp(lvl, 1, 10);

        using var targetList = EntityListPool.Get();
        map.GatherEnemiesInArea(source.Character, source.Character.Position, BlastDistance, targetList, true, true);

        map.AddVisiblePlayersAsPacketRecipients(source.Character);

        var ratio = (100 + 10 * lvl) / 150f; //73% MATK at level 1, 100% at level 5, 133% at level 10
        var freezeChance = 330 + 50 * lvl; //38% at level 1 up to 83% at level 10, out of 1000

        foreach (var e in targetList)
        {
            if (!e.TryGet<CombatEntity>(out var victim) || !e.TryGet<WorldObject>(out var victimObject))
                continue;

            //something that is already frozen is left alone, otherwise the nova would spend itself on it
            if (victim.HasBodyState(BodyStateFlags.Frozen))
                continue;

            var res = source.CalculateCombatResult(victim, ratio, 1, AttackFlags.Magical, CharacterSkill.FrostNova, AttackElement.Water);
            res.Time += source.Character.WorldPosition.DistanceTo(victimObject.WorldPosition) * 0.03f; //the ring spreads out from the caster
            source.ExecuteCombatResult(res, false);

            CommandBuilder.AttackMulti(source.Character, victimObject, res, false);

            //the freeze lands just after the damage, so the hit itself cannot be what breaks it
            if (res.IsDamageResult)
                source.TryFreezeTarget(victim, freezeChance, res.TimeInSeconds + 0.1f);
        }

        if (!isIndirect)
        {
            source.ApplyAfterCastDelay(1f);
            source.ApplyCooldownForAttackAction(source.Character.Position);
        }

        CommandBuilder.SkillExecuteSelfTargetedSkillAutoVis(source.Character, CharacterSkill.FrostNova, lvl, isIndirect);
    }
}
