using RebuildSharedData.Enum.EntityStats;

namespace RebuildSharedData.Enum;

/// <summary>What one guild skill is worth for each level taken.</summary>
public readonly struct GuildSkillEffect
{
    public readonly CharacterStat Stat;
    public readonly int PerLevel;

    /// <summary>
    /// Whether this shows up in the stat the server sends, or is read straight off the guild
    /// somewhere else. Guild Blessing is the odd one: experience is worked out when it is
    /// handed over, not held as a stat, so a summary has to add it on itself.
    /// </summary>
    public readonly bool IsStat;

    public GuildSkillEffect(CharacterStat stat, int perLevel, bool isStat = true)
    {
        Stat = stat;
        PerLevel = perLevel;
        IsStat = isStat;
    }
}

/// <summary>
/// What each guild skill gives, in one table both sides read.
///
/// The server applies these to a member's stats; the client says where a number came from.
/// Written once because two copies of the same figures is two copies that can disagree, and
/// the one that would be wrong is the one nobody tests - the explanation, not the effect.
/// </summary>
public static class GuildSkillBonus
{
    public static GuildSkillEffect For(GuildSkill skill)
    {
        switch (skill)
        {
            case GuildSkill.Leadership: return new GuildSkillEffect(CharacterStat.AddStr, 1);
            case GuildSkill.GloryOfGuild: return new GuildSkillEffect(CharacterStat.AddVit, 1);
            case GuildSkill.SharpGaze: return new GuildSkillEffect(CharacterStat.AddDex, 2);
            case GuildSkill.Regeneration: return new GuildSkillEffect(CharacterStat.AddHpRecoveryPercent, 10);

            //Experience is added at the moment it is handed over rather than kept as a stat,
            //so this one is marked as not being in the stat block a summary reads.
            case GuildSkill.GuildBlessing: return new GuildSkillEffect(CharacterStat.AddExpPercent, 2, false);

            default: return new GuildSkillEffect(CharacterStat.Level, 0);
        }
    }
}
