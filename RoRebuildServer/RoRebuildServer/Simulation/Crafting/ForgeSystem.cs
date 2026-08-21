using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;

namespace RoRebuildServer.Simulation.Crafting;

/// <summary>
/// Making things with a skill rather than at an npc.
///
/// The shape is the one the refine counter uses: check everything first, take the
/// materials and the fee, then roll. Taking payment before the roll is the point - a
/// failed attempt has to cost something or there is no reason to have levelled the skill.
/// </summary>
public static class ForgeSystem
{
    /// <summary>
    /// Odds are carried in ten-thousandths all the way to the client.
    ///
    /// Whole percent is too coarse for this: the difference between two blacksmiths is
    /// often a few hundred of these, and rounding it away would make levelling the skill
    /// look like it did nothing.
    /// </summary>
    public const int ChanceScale = 10000;

    /// <summary>
    /// What this character's chances are on this recipe, in ten-thousandths.
    ///
    /// The recipe brings the difficulty, the character brings everything else. Dex and luk
    /// are the forging stats, job level is the time put in, and the skill's own level is
    /// worth the most of the four - a master smelter should feel like one.
    /// </summary>
    public static int CalculateSuccessChance(Player player, ProduceRecipe recipe)
    {
        var skillLevel = player.MaxLearnedLevelOfSkill(recipe.Skill);

        var chance = recipe.BaseChance
                     + skillLevel * 500
                     + player.JobLevel * 20
                     + player.GetStat(CharacterStat.Dex) * 10
                     + player.GetStat(CharacterStat.Luk) * 10;

        return int.Clamp(chance, 0, ChanceScale);
    }

    /// <summary>Whether a recipe is worth showing this character at all.</summary>
    public static bool CanSeeRecipe(Player player, ProduceRecipe recipe) =>
        player.MaxLearnedLevelOfSkill(recipe.Skill) >= recipe.MinSkillLevel;

    /// <summary>
    /// One attempt.
    ///
    /// Everything is checked before anything is taken, so a request that turns out to be
    /// impossible cannot leave the player short of the materials it had already removed.
    /// </summary>
    public static CraftResult AttemptCraft(Player player, CharacterSkill skill, int resultId)
    {
        if (!CraftingSkills.IsCraftingSkill(skill))
            return CraftResult.UnknownRecipe;

        if (!DataManager.TryGetProduceRecipe(skill, resultId, out var recipe))
            return CraftResult.UnknownRecipe;

        if (player.MaxLearnedLevelOfSkill(skill) < recipe.MinSkillLevel)
            return CraftResult.SkillTooLow;

        var inventory = player.Inventory;
        if (inventory == null)
            return CraftResult.MissingMaterials;

        foreach (var material in recipe.Materials)
            if (inventory.GetItemCount(material.ItemId) < material.Count)
                return CraftResult.MissingMaterials;

        if (player.GetZeny() < recipe.Zeny)
            return CraftResult.NotEnoughZeny;

        //Checked before the materials are spent even though the result only appears on a
        //success, because a player who cannot carry what they are making should be told
        //that instead of losing the ore to find out.
        if (!player.CanPickUpItem(new ItemReference(recipe.ResultId, recipe.ResultCount)))
            return CraftResult.BagFull;

        foreach (var material in recipe.Materials)
            player.TryRemoveItemFromInventory(material.ItemId, material.Count, true);

        if (recipe.Zeny > 0)
            player.DropZeny(recipe.Zeny);

        var chance = CalculateSuccessChance(player, recipe);

        //Next is exclusive of its upper bound, so a chance of the full scale can never
        //roll above itself and a chance of zero can never roll below.
        if (GameRandom.Next(0, ChanceScale) >= chance)
            return CraftResult.Failed;

        player.CreateItemInInventory(new ItemReference(recipe.ResultId, recipe.ResultCount));

        return CraftResult.Success;
    }
}
