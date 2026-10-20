using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RoRebuildServer.EntityComponents;

namespace RoRebuildServer.Simulation.Skills.SkillHandlers.Wizard;

//Ice Wall needs two things the engine does not have yet: a way to block cells while the wall stands
//(MapWalkData is static) and a visual for the wall on the client. Until then it is left out of the
//skill tree, and refuses to run here so a stale hotbar slot or an old save cannot spend SP on it.
[SkillHandler(CharacterSkill.IceWall, SkillClass.Magic, SkillTarget.Ground)]
public class IceWallHandler : SkillHandlerBase
{
    public override SkillValidationResult ValidateTarget(CombatEntity source, CombatEntity? target, Position position, int lvl, bool isIndirect, bool isItemSource) =>
        SkillValidationResult.Failure;

    public override void Process(CombatEntity source, CombatEntity? target, Position position, int lvl, bool isIndirect, bool isItemSource)
    {
    }
}
