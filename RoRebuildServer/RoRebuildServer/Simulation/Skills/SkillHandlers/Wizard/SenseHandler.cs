using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RoRebuildServer.EntityComponents;

namespace RoRebuildServer.Simulation.Skills.SkillHandlers.Wizard;

//Not implemented yet, and not in the skill tree. Refuses to run so a stale hotbar slot or an old
//save cannot spend SP on a skill that does nothing.
[SkillHandler(CharacterSkill.Sense, SkillClass.Magic, SkillTarget.Enemy)]
public class SenseHandler : SkillHandlerBase
{
    public override SkillValidationResult ValidateTarget(CombatEntity source, CombatEntity? target, Position position, int lvl, bool isIndirect, bool isItemSource) =>
        SkillValidationResult.Failure;

    public override void Process(CombatEntity source, CombatEntity? target, Position position, int lvl, bool isIndirect, bool isItemSource)
    {
    }
}
