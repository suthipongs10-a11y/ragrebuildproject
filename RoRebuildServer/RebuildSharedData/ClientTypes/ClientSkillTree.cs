using RebuildSharedData.Enum;

namespace RebuildSharedData.ClientTypes;

[Serializable]
public class ClientPrereq
{
    public CharacterSkill Skill;
    public int Level;
}

[Serializable]
public class ClientSkillTreeEntry
{
    public CharacterSkill Skill;
    public ClientPrereq[]? Prerequisites;
}

[Serializable]
public class ClientSkillTree
{
    public int ClassId;
    public int ExtendsClass;
    public int JobRank;

    //how many skill points must already be spent in the jobs below this one before any
    //skill on this tier may be raised. The server refuses the point otherwise, so the
    //window needs the same number to be able to say why a button is dead.
    public int PrereqSkillPoints;

    public List<ClientSkillTreeEntry> Skills = new();
}