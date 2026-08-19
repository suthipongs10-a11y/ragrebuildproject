namespace RebuildSharedData.Enum;

/// <summary>
/// What a guild can learn, and give to everyone in it.
///
/// The order is a save format: the levels are stored as a list of numbers in this order,
/// so entries may be added at the end and must never be reordered or removed.
/// </summary>
public enum GuildSkill : byte
{
    /// <summary>+1 STR per level.</summary>
    Leadership,

    /// <summary>+1 VIT per level.</summary>
    GloryOfGuild,

    /// <summary>+2 DEX per level.</summary>
    SharpGaze,

    /// <summary>Health comes back faster, by a tenth per level.</summary>
    Regeneration,

    /// <summary>Every member earns more experience, by two percent per level.</summary>
    GuildBlessing,

    /// <summary>Not a skill - the number of them, for sizing the list.</summary>
    Count,
}
