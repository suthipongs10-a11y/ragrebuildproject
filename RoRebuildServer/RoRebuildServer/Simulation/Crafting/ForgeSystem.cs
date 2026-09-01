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
///
/// A weapon is the same pipeline with two extras hung off it: a stone that gives it an
/// element, and up to three star crumbs that make it hit harder. Both make the attempt
/// less likely to work, which is the whole trade - the good version of a weapon is the one
/// you were willing to lose the materials over.
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

    /// <summary>What binding an element into a weapon costs in odds: a quarter of them.</summary>
    public const int ElementStonePenalty = 2500;

    /// <summary>What each star crumb costs in odds.</summary>
    public const int StarCrumbPenalty = 1500;

    /// <summary>Three is the limit, and the third is worth far more than the first two.</summary>
    public const int MaxStarCrumbs = 3;

    /// <summary>A full set of crumbs is also worth this much of the weapon's own attack.</summary>
    public const int TripleCrumbAttackPercent = 25;

    /// <summary>
    /// Attack a weapon gains from the crumbs forged into it.
    ///
    /// Five each for the first two and then a jump, which is the original's doing: it
    /// clamps the total up to forty the moment all three are in. A triple crumb weapon is
    /// meant to be worth the three failures it took to get one.
    /// </summary>
    /// <remarks>
    /// The share of the weapon's own attack is ours rather than the original's, and it is
    /// there because a flat forty rewards the wrong weapon. Forty on a Mace of thirty-seven
    /// attack more than doubles it; forty on a Claymore of a hundred and eighty is a fifth.
    /// The Claymore is the one that takes four times as many attempts to make - the base
    /// odds run forty percent at weapon level one and ten at level three - so the flat
    /// number was paying out in inverse proportion to the work.
    ///
    /// A quarter is sized against what a smith can actually forge, which tops out at level
    /// three: the whole range is thirty-seven to a hundred and eighty-five attack, so this
    /// adds between nine and forty-six and cannot run away anywhere.
    /// </remarks>
    public static int StarCrumbAttackBonus(int crumbs, int weaponAttack) =>
        crumbs >= MaxStarCrumbs ? 40 + weaponAttack * TripleCrumbAttackPercent / 100 : crumbs * 5;

    /// <summary>
    /// An anvil in the bag steadies the work. It is not spent, only carried, and only the
    /// best one counts.
    /// </summary>
    /// <remarks>
    /// The bonuses are the original's, in ten-thousandths: an Emperium anvil is worth ten
    /// percent of the roll and a plain one is worth nothing at all, which is why the plain
    /// one is in the list rather than left out. It is the anvil somebody buys first and
    /// finding it does nothing is a thing worth being able to read in one place.
    ///
    /// Carried rather than spent, which is the difference between an anvil and a hammer: an
    /// anvil is bought once and improves every weapon after it, a hammer is stock.
    /// </remarks>
    private static readonly (string Code, int Bonus)[] anvils =
    [
        ("Emperium_Anvil", 1000),
        ("Golden_Anvil", 500),
        ("Oridecon_Anvil", 300),
        ("Anvil", 0)
    ];

    /// <summary>What the smelting skills burn, one per attempt, whatever comes out.</summary>
    public const string FurnaceCode = "Mini_Furnace";

    /// <summary>The hammer a weapon of each level is beaten out with. Index is the level.</summary>
    private static readonly string?[] hammersByWeaponLevel =
    [
        null,               //no such thing as a level 0 weapon
        "Iron_Hammer",
        "Golden_Hammer",
        "Oridecon_Hammer"
    ];

    /// <summary>
    /// The tool one attempt at this recipe consumes, or nothing if it needs none.
    /// </summary>
    /// <remarks>
    /// A rule rather than a column, because it is one: a level two weapon takes a golden
    /// hammer whatever else is in the recipe, and anything smelted takes a furnace. Written
    /// into ProduceRecipes.csv it would have been twenty-nine chances to name the wrong
    /// hammer, and the twenty-ninth would have been found by a player.
    ///
    /// The loader turns what this returns into an ordinary material, so it is checked,
    /// spent and listed in the window by the code that already does all three. Nothing else
    /// in the forge knows tools exist.
    /// </remarks>
    public static string? ToolCodeFor(bool isWeapon, int weaponLevel)
    {
        if (!isWeapon)
            return FurnaceCode;

        return weaponLevel > 0 && weaponLevel < hammersByWeaponLevel.Length
            ? hammersByWeaponLevel[weaponLevel]
            : null;
    }

    private static int AnvilBonus(Player player)
    {
        var inventory = player.Inventory;
        if (inventory == null)
            return 0;

        foreach (var (code, bonus) in anvils)
        {
            if (DataManager.ItemIdByName.TryGetValue(code, out var id) && inventory.GetItemCount(id) > 0)
                return bonus;
        }

        return 0;
    }

    /// <summary>
    /// What this character's chances are on this recipe, in ten-thousandths.
    ///
    /// The recipe brings the difficulty, the character brings everything else. Dex and luk
    /// are the forging stats, job level is the time put in, and the skill's own level is
    /// worth the most of the four - a master smelter should feel like one.
    ///
    /// A weapon adds the research skills and the anvil on top, and takes off whatever is
    /// being bound into it. The flat five hundred it also gets stands in for a random term
    /// the original rolls at the same moment: an average of it, so the number shown here is
    /// the number rolled against rather than one of a hundred it might have been.
    /// </summary>
    public static int CalculateSuccessChance(Player player, ProduceRecipe recipe, bool withStone = false, int starCrumbs = 0)
    {
        var skillLevel = player.MaxLearnedLevelOfSkill(recipe.Skill);

        var chance = recipe.BaseChance
                     + skillLevel * 500
                     + player.JobLevel * 20
                     + player.GetStat(CharacterStat.Dex) * 10
                     + player.GetStat(CharacterStat.Luk) * 10;

        if (recipe.IsWeapon)
        {
            chance += 500;
            chance += player.MaxLearnedLevelOfSkill(CharacterSkill.WeaponryResearch) * 100;

            //Oridecon Research is the level 3 weapons and nothing else, which is the one
            //thing the skill has ever done.
            if (recipe.WeaponLevel >= 3)
                chance += player.MaxLearnedLevelOfSkill(CharacterSkill.OrideconResearch) * 100;

            chance += AnvilBonus(player);

            if (withStone)
                chance -= ElementStonePenalty;

            chance -= starCrumbs * StarCrumbPenalty;
        }

        return int.Clamp(chance, 0, ChanceScale);
    }

    /// <summary>Whether a recipe is worth showing this character at all.</summary>
    public static bool CanSeeRecipe(Player player, ProduceRecipe recipe) =>
        player.MaxLearnedLevelOfSkill(recipe.Skill) >= recipe.MinSkillLevel;

    /// <summary>
    /// Whether this character may bind an element into what they forge.
    ///
    /// Weapon Binding is what buys the socket. Without it the window offers no stone, and
    /// a request naming one is turned down here rather than quietly ignored - a player who
    /// spent a Flame Heart deserves to know it was not used.
    /// </summary>
    public static bool CanBindElement(Player player) =>
        player.MaxLearnedLevelOfSkill(CharacterSkill.WeaponBinding) >= 1;

    /// <summary>
    /// One attempt.
    ///
    /// Everything is checked before anything is taken, so a request that turns out to be
    /// impossible cannot leave the player short of the materials it had already removed.
    /// </summary>
    public static CraftResult AttemptCraft(Player player, CharacterSkill skill, int resultId, int stoneId, int starCrumbs)
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

        //Sockets are a weapon's business. Anything else quietly forgets them rather than
        //failing, since a client that sends them for an ore recipe is confused, not hostile.
        if (!recipe.IsWeapon)
        {
            stoneId = 0;
            starCrumbs = 0;
        }

        starCrumbs = int.Clamp(starCrumbs, 0, MaxStarCrumbs);

        if (stoneId > 0)
        {
            if (!CanBindElement(player))
                return CraftResult.CannotBindElement;

            if (!DataManager.ForgeStones.Contains(stoneId))
                return CraftResult.CannotBindElement;
        }

        var starCrumbId = DataManager.ItemIdByName.GetValueOrDefault("Star_Crumb", 0);
        if (starCrumbs > 0 && starCrumbId <= 0)
            return CraftResult.MissingMaterials;

        foreach (var material in recipe.Materials)
            if (inventory.GetItemCount(material.ItemId) < material.Count)
                return CraftResult.MissingMaterials;

        if (stoneId > 0 && inventory.GetItemCount(stoneId) < 1)
            return CraftResult.MissingMaterials;

        if (starCrumbs > 0 && inventory.GetItemCount(starCrumbId) < starCrumbs)
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

        if (stoneId > 0)
            player.TryRemoveItemFromInventory(stoneId, 1, true);

        if (starCrumbs > 0)
            player.TryRemoveItemFromInventory(starCrumbId, starCrumbs, true);

        if (recipe.Zeny > 0)
            player.DropZeny(recipe.Zeny);

        var chance = CalculateSuccessChance(player, recipe, stoneId > 0, starCrumbs);

        //Next is exclusive of its upper bound, so a chance of the full scale can never
        //roll above itself and a chance of zero can never roll below.
        if (GameRandom.Next(0, ChanceScale) >= chance)
            return CraftResult.Failed;

        var made = new ItemReference(recipe.ResultId, recipe.ResultCount);

        if (recipe.IsWeapon && made.Type == ItemType.UniqueItem)
        {
            made.UniqueItem.Flags = (byte)UniqueItemFlags.CraftedItem;

            //Crumbs first and the stone last, because the name is read out of the slots in
            //order: three crumbs and a flame heart should say "Very Very Strong Fire Blade"
            //and not put the fire in front of the strength.
            var slot = 0;
            for (var i = 0; i < starCrumbs; i++)
                made.UniqueItem.SetSlotData(slot++, starCrumbId);

            if (stoneId > 0)
                made.UniqueItem.SetSlotData(slot, stoneId);

            //The smith's name goes on the weapon, which is half of why anyone forges one.
            //Kept against the item's guid rather than in it - there is no room in a
            //UniqueItem, and the four slots it does have are full of what went into this.
            //
            //The rank is read before the points are added, so this weapon is stamped with
            //the standing its maker had when they started it rather than the one it earned
            //them. Plain work earns nothing: a weapon with no stone and no crumbs in it is
            //a weapon anybody could have turned out, and paying for those would make the
            //fastest route to a title the cheapest recipe in the book.
            var forgerRank = ForgeFame.RankFor(ForgedItemRegistry.FameFor(player.Id));
            var famePoints = ForgeFame.PointsFor(recipe.WeaponLevel, stoneId > 0, starCrumbs);

            ForgedItemRegistry.Record(made.UniqueItem.UniqueId, player.Id, player.Name, forgerRank, famePoints);
        }

        player.CreateItemInInventory(made);

        return CraftResult.Success;
    }
}
