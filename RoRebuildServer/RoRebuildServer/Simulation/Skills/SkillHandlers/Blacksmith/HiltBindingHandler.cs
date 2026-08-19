using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;

namespace RoRebuildServer.Simulation.Skills.SkillHandlers.Blacksmith;

/// <summary>
/// The half of Hilt Binding that was missing.
///
/// The skill's own description promises "Adds STR + 1, ATK + 5, and improves the duration
/// of Adrenaline Rush, Power Thrust, and Weapon Perfection by 10%." Only the duration was
/// implemented - the three buffs each ask whether the caster has this skill - so the skill
/// had no handler of its own and the stats it says it gives were never applied.
/// </summary>
[SkillHandler(CharacterSkill.HiltBinding, SkillClass.Physical, SkillTarget.Passive)]
public class HiltBindingHandler : SkillHandlerBase
{
    public override void ApplyPassiveEffects(CombatEntity owner, int lvl)
    {
        owner.AddStat(CharacterStat.AddStr, 1);
        owner.AddStat(CharacterStat.AddAttackPower, 5);
    }

    public override void RemovePassiveEffects(CombatEntity owner, int lvl)
    {
        owner.SubStat(CharacterStat.AddStr, 1);
        owner.SubStat(CharacterStat.AddAttackPower, 5);
    }

    public override void Process(CombatEntity source, CombatEntity? target, Position position, int lvl,
        bool isIndirect, bool isItemSource)
    {
        throw new NotImplementedException();
    }
}
