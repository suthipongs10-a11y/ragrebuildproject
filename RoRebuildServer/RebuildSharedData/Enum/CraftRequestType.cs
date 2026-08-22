namespace RebuildSharedData.Enum;

/// <summary>
/// What the forge window is asking the server to do. Sent as the first byte of a
/// CraftAction packet, the same shape the market and guild windows use.
/// </summary>
public enum CraftRequestType : byte
{
    /// <summary>Send me what this skill can make. Payload: byte skill.</summary>
    RecipeList,

    /// <summary>
    /// Make one. Payload: byte skill, int resultItemId, int elementStoneId, byte starCrumbs.
    ///
    /// The stone is zero for none, and the crumbs are zero to three. Both are ignored for
    /// anything that is not a weapon.
    /// </summary>
    Craft,
}

/// <summary>What a CraftData packet is carrying.</summary>
public enum CraftDataType : byte
{
    /// <summary>Everything one skill can make, with what it costs and the odds.</summary>
    RecipeList,

    /// <summary>How one attempt went.</summary>
    Result,
}

/// <summary>
/// How an attempt ended.
///
/// Failed is its own answer rather than an error: the materials really are gone and the
/// window has to say so, which is a different sentence from "you were never able to try".
/// </summary>
public enum CraftResult : byte
{
    /// <summary>It worked. The item is already in the bag.</summary>
    Success,

    /// <summary>The roll was lost. Materials and zeny are spent, nothing was made.</summary>
    Failed,

    /// <summary>That skill cannot make that, or the recipe is gone from the data.</summary>
    UnknownRecipe,

    /// <summary>The skill is not learned high enough for this recipe.</summary>
    SkillTooLow,

    /// <summary>One or more of the materials is missing.</summary>
    MissingMaterials,

    /// <summary>Not enough zeny for the fee.</summary>
    NotEnoughZeny,

    /// <summary>Nowhere to put the result.</summary>
    BagFull,

    /// <summary>A stone was named without Weapon Binding, or one that cannot be bound.</summary>
    CannotBindElement,
}
