using RebuildSharedData.Data;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>One line of a recipe.</summary>
public readonly record struct EnchantMaterial(string Code, int Count);

/// <summary>
/// What a scroll costs at the scribe, and how often the work comes out at all.
/// </summary>
/// <remarks>
/// The odds are the forge's shape rather than a new one: a base by tier, a small climb
/// from luck and job level, and a ceiling under a hundred so nothing is ever certain. A
/// player who has stood at a blacksmith knows what this feels like before it is explained.
///
/// Materials are spent whether or not the roll lands, which is the whole reason there is a
/// roll. A failure that cost nothing would make the odds a formality and the scribe a slow
/// vending machine.
///
/// Only earth and sky can be made. Heaven wants card dust and boss leavings, legend wants a
/// heaven scroll as an ingredient, and both are meant to arrive once the first two have
/// been running long enough to know whether the drain is right.
/// </remarks>
public static class EnchantRecipes
{
    /// <summary>Odds in ten thousandths, matching the forge so the two can be read together.</summary>
    public const int ChanceScale = 10000;

    /// <summary>Nothing is ever certain, however good the smith.</summary>
    public const int MaxChance = 9000;

    private static readonly int[] baseChance = [8000, 6000, 3500, 1500];
    private static readonly int[] zeny = [1000, 10000, 100000, 1000000];

    private static readonly EnchantMaterial[][] materials =
    [
        [
            new("Red_Stocking", 20), new("Jellopy", 25), new("Insect_Peeling", 25),
            new("Shell", 25), new("Stem", 25), new("Single_Cell", 25)
        ],
        [
            new("Red_Stocking", 40), new("Cyfar", 50), new("Blue_Hair", 50),
            new("Sharp_Scale", 50), new("Rotten_Bandage", 50), new("Skel-Bone", 50),
            new("Opal", 1), new("Amethyst", 1), new("Pearl", 1)
        ],
        [
            new("Red_Stocking", 100), new("Worn_Out_Page", 100), new("Yellow_Plate", 100),
            new("Round_Shell", 100), new("Nose_Ring", 100), new("Mud_Lump", 100),
            new("Gold", 2), new("Cracked_Diamond", 2),
            new("Toxic_Gas", 1), new("Tattered_Clothes", 1), new("Black_Dyestuffs", 1),
            new("Card_Dust", 1)
        ],
        [
            new("Red_Stocking", 200), new("Agate", 5), new("Biotite", 5), new("Citrin", 5),
            new("Muscovite", 5), new("Peridot", 5), new("Phlogopite", 5), new("Pyroxene", 5),
            new("Rose_Quartz", 5), new("Turquoise", 5), new("Emperium", 5),
            new("Card_Dust", 5)
        ]
    ];

    /// <summary>
    /// What clearing a block costs, and it is not a gamble.
    /// </summary>
    /// <remarks>
    /// Twenty-five earth scrolls' worth of stockings for one, which sounds punishing until
    /// you notice it is the only way to undo anything: a scroll cannot be written over, so
    /// without this a bad roll is permanent and the piece is finished. Paying heavily to
    /// take a block off is the price of the block being safe to try in the first place.
    ///
    /// No roll. A tool that failed would mean a player who cannot clear an item and cannot
    /// write on it either, which is a piece of equipment nobody can do anything with.
    /// </remarks>
    private static readonly EnchantMaterial[] blankMaterials = [new("Red_Stocking", 500)];

    private const int BlankZeny = 100000;

    public static EnchantMaterial[] BlankRecipe => blankMaterials;

    public static int BlankZenyCost => BlankZeny;

    /// <summary>The tiers the scribe will attempt today.</summary>
    public static bool CanCraft(EnchantTier tier) => tier == EnchantTier.Earth || tier == EnchantTier.Sky;

    public static EnchantMaterial[] MaterialsFor(EnchantTier tier) => materials[(int)tier - 1];

    public static int ZenyFor(EnchantTier tier) => zeny[(int)tier - 1];

    public static int BaseChanceFor(EnchantTier tier) => baseChance[(int)tier - 1];

    /// <summary>
    /// What this player's odds actually are, all in.
    /// </summary>
    /// <remarks>
    /// Luck and job level, ten thousandths each per point, which is the forge's own climb
    /// with the blacksmith-only parts taken out - the scribe is not a smith and every job
    /// has to be able to stand here. Sixty luck and job fifty is eleven percent, which is
    /// worth having without being worth rerolling a character over.
    /// </remarks>
    public static int ChanceFor(Player player, EnchantTier tier)
    {
        var chance = BaseChanceFor(tier);
        chance += player.CombatEntity.GetEffectiveStat(CharacterStat.Luck) * 10;
        chance += player.JobLevel * 10;

        return int.Clamp(chance, 0, MaxChance);
    }

    public static bool Roll(Player player, EnchantTier tier) =>
        GameRandom.Next(0, ChanceScale) < ChanceFor(player, tier);

    /// <summary>The item name to show, falling back to the code if the item is missing.</summary>
    public static string NameOf(string code) =>
        DataManager.ItemIdByName.TryGetValue(code, out var id)
        && DataManager.ItemList.TryGetValue(id, out var data)
            ? data.Name
            : code;
}
