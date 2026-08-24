using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;

namespace RoRebuildServer.Simulation.Guilds;

/// <summary>What one guild skill is and how far it goes.</summary>
public readonly struct GuildSkillInfo(GuildSkill skill, string name, int maxLevel)
{
    public readonly GuildSkill Skill = skill;
    public readonly string Name = name;
    public readonly int MaxLevel = maxLevel;
}

/// <summary>
/// The skills a guild buys with the levels it earns, and what they do to its members.
///
/// The bonuses are applied from inside the player's own stat recalculation rather than
/// added when a skill is learned and subtracted when somebody leaves. That pairing is the
/// thing that goes wrong: miss one subtraction - on a kick, on a disband, on a log out
/// during a level up - and a player walks away with the guild's strength forever, with
/// nothing to point at afterwards. Recalculation cannot leak, because leaving simply means
/// there is nothing to add on the next pass.
/// </summary>
public static class GuildSkills
{
    public static readonly GuildSkillInfo[] All =
    {
        new(GuildSkill.Leadership, "Leadership", 5),
        new(GuildSkill.GloryOfGuild, "Glory of Guild", 5),
        new(GuildSkill.SharpGaze, "Sharp Gaze", 5),
        new(GuildSkill.Regeneration, "Regeneration", 3),
        new(GuildSkill.GuildBlessing, "Guild Blessing", 5),
    };

    public static int MaxLevelOf(GuildSkill skill)
    {
        foreach (var info in All)
        {
            if (info.Skill == skill)
                return info.MaxLevel;
        }

        return 0;
    }

    /// <summary>
    /// Adds what this player's guild gives them.
    ///
    /// Called from UpdateStats, after the base stats have been set back to what the
    /// character actually has, so this is always adding to a clean number.
    /// </summary>
    public static void ApplyTo(Player player)
    {
        var guild = player.Guild;
        if (guild == null)
            return;

        //Read out of the shared table rather than written out here, so that the window that
        //tells a player where their strength came from is quoting the same numbers that gave
        //it to them. Two copies of these figures is two copies that can disagree, and the one
        //that would be wrong is the explanation - which nobody tests.
        foreach (var info in All)
        {
            var level = guild.SkillLevel(info.Skill);
            if (level <= 0)
                continue;

            var effect = GuildSkillBonus.For(info.Skill);
            if (!effect.IsStat || effect.PerLevel == 0)
                continue;

            player.CombatEntity.AddStat(effect.Stat, level * effect.PerLevel);
        }
    }

    /// <summary>Whether this guild has learned anything at all.</summary>
    public static bool HasAnySkill(Guild guild)
    {
        foreach (var level in guild.SkillLevels)
        {
            if (level > 0)
                return true;
        }

        return false;
    }

    /// <summary>
    /// Puts the mark on the buff bar, or takes it off.
    ///
    /// Separate from the bonuses on purpose. The bonuses are recalculated and so cannot be
    /// left behind; a status effect is a thing that is added and removed, and there is no
    /// way around that - so it is kept to the one thing where being stale is only a wrong
    /// icon rather than wrong stats. Called from the same place, so the two cannot drift.
    /// </summary>
    public static void RefreshBuffIcon(Player player)
    {
        var guild = player.Guild;
        var wanted = guild != null && HasAnySkill(guild);
        var has = player.CombatEntity.HasStatusEffectOfType(CharacterStatusEffect.GuildBuff);

        if (wanted && !has)
            player.CombatEntity.AddStatusEffect(CharacterStatusEffect.GuildBuff, int.MaxValue);
        else if (!wanted && has)
            player.CombatEntity.RemoveStatusOfTypeIfExists(CharacterStatusEffect.GuildBuff);
    }

    /// <summary>How much more experience a member earns, as a percentage.</summary>
    public static int ExperienceBonus(Player player)
    {
        var guild = player.Guild;
        if (guild == null)
            return 0;

        //The per-level figure comes out of the same table the stat bonuses do, so the summary
        //window and the experience handout can never quote different numbers.
        return guild.SkillLevel(GuildSkill.GuildBlessing) * GuildSkillBonus.For(GuildSkill.GuildBlessing).PerLevel;
    }

    /// <summary>
    /// The same amount of experience with the guild's share added on.
    ///
    /// Rounded rather than truncated, and that is the whole point of it being here: two
    /// percent of anything under fifty is less than one, so integer division would hand
    /// back the number it was given and the skill would look broken on every small kill.
    /// Widened to long first because the multiply, not the result, is what would overflow.
    /// </summary>
    public static int ApplyExperienceBonus(Player player, int exp)
    {
        var bonus = ExperienceBonus(player);
        if (bonus <= 0 || exp <= 0)
            return exp;

        return (int)Math.Min(((long)exp * (100 + bonus) + 50) / 100, int.MaxValue);
    }
}
