using System.Diagnostics;
using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Util;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Simulation.Skills.SkillHandlers.Wizard;

[SkillHandler(CharacterSkill.Sightrasher, SkillClass.Magic, SkillTarget.Self)]
public class SighthrasherHandler : SkillHandlerBase
{
    private const int BlastDistance = 5; //5 tiles out from the caster = 11x11
    private const int KnockBackDistance = 5;

    public override float GetCastTime(CombatEntity source, CombatEntity? target, Position position, int lvl) => 0.5f;

    //The burst is fired out of an active Sight and uses it up. This is checked when the skill is
    //pressed and again when the cast ends, so a Sight that runs out during the cast stops it
    //before any SP is taken.
    //
    //The refusal is explained with a chat line of its own and returns InvalidTarget, because that
    //is a result the client already ignores - any other result would print a second, generic
    //"skill failed" line on top of the real reason.
    public override SkillValidationResult ValidateTarget(CombatEntity source, CombatEntity? target, Position position, int lvl, bool isIndirect, bool isItemSource)
    {
        if (source.Character.Type == CharacterType.Player && !source.HasStatusEffectOfType(CharacterStatusEffect.Sight))
        {
            CommandBuilder.ErrorMessage(source.Player, "ใช้ Sightrasher ไม่ได้: ต้องเปิด Sight ไว้ก่อน (Sight ต้องยังไม่หมดเวลา)");
            return SkillValidationResult.InvalidTarget;
        }

        return base.ValidateTarget(source, target, position, lvl, isIndirect, isItemSource);
    }

    public override void Process(CombatEntity source, CombatEntity? target, Position position, int lvl, bool isIndirect, bool isItemSource)
    {
        var map = source.Character.Map;
        Debug.Assert(map != null);

        lvl = int.Clamp(lvl, 1, 10);

        source.RemoveStatusOfTypeIfExists(CharacterStatusEffect.Sight);

        using var targetList = EntityListPool.Get();
        map.GatherEnemiesInArea(source.Character, source.Character.Position, BlastDistance, targetList, true, true);

        map.AddVisiblePlayersAsPacketRecipients(source.Character);

        var ratio = 1f + 0.2f * lvl; //120% MATK at level 1 up to 300% at level 10

        foreach (var e in targetList)
        {
            if (!e.TryGet<CombatEntity>(out var victim) || !e.TryGet<WorldObject>(out var victimObject))
                continue;

            var res = source.CalculateCombatResult(victim, ratio, 1, AttackFlags.Magical, CharacterSkill.Sightrasher, AttackElement.Fire);
            res.KnockBack = KnockBackDistance;
            res.AttackPosition = source.Character.Position;
            res.Time += source.Character.WorldPosition.DistanceTo(victimObject.WorldPosition) * 0.03f; //the fire spreads out from the caster
            source.ExecuteCombatResult(res, false);

            CommandBuilder.AttackMulti(source.Character, victimObject, res, false);
        }

        if (!isIndirect)
        {
            source.ApplyAfterCastDelay(2f);
            source.ApplyCooldownForAttackAction(source.Character.Position);
        }

        CommandBuilder.SkillExecuteSelfTargetedSkillAutoVis(source.Character, CharacterSkill.Sightrasher, lvl, isIndirect);
    }
}
