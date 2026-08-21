using RebuildSharedData.Enum;

namespace RoRebuildServer.Simulation.Crafting;

/// <summary>One material a recipe eats, resolved to an id at load.</summary>
public readonly struct ProduceMaterial(int itemId, int count)
{
    public readonly int ItemId = itemId;
    public readonly int Count = count;
}

/// <summary>
/// A row of Db/ProduceRecipes.csv with every name resolved to an id.
///
/// Held per skill, since that is how the window asks for them: press Iron Tempering and
/// what comes back is this skill's list and nothing else.
/// </summary>
public class ProduceRecipe
{
    public required CharacterSkill Skill { get; init; }
    public required int ResultId { get; init; }
    public required int ResultCount { get; init; }
    public required int MinSkillLevel { get; init; }
    public required int BaseChance { get; init; }
    public required int Zeny { get; init; }
    public required ProduceMaterial[] Materials { get; init; }
}
