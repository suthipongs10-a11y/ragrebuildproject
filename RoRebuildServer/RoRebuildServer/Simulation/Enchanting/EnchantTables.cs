using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.Data;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// Which pool an item draws from. The slot it is worn in, never the job wearing it.
/// </summary>
/// <remarks>
/// A mage can roll strength and a knight can roll intelligence, on purpose. If every item
/// rolled the stats its owner wanted, every item would come out the same and there would
/// be nothing worth buying off anybody. The piece that happens to land on your stats is
/// the piece somebody pays for.
/// </remarks>
[Flags]
public enum EnchantSlotFamily : byte
{
    None = 0,
    Weapon = 1,
    Armour = 2,      //head, body, shield, garment, shoes
    Accessory = 4,

    Offensive = Weapon | Accessory,
    Defensive = Armour | Accessory,
    Any = Weapon | Armour | Accessory
}

/// <summary>
/// One stat a scroll can roll, and how much of it each tier hands out.
/// </summary>
public sealed class EnchantStat
{
    public readonly CharacterStat Stat;
    public readonly EnchantSlotFamily Families;

    /// <summary>Indexed from Earth at zero. A max of zero means this tier does not offer it.</summary>
    private readonly (int Min, int Max)[] byTier;

    public EnchantStat(CharacterStat stat, EnchantSlotFamily families, (int Min, int Max)[] byTier)
    {
        Stat = stat;
        Families = families;
        this.byTier = byTier;
    }

    public bool OfferedAt(EnchantTier tier) => Band(tier).Max > 0;

    public (int Min, int Max) Band(EnchantTier tier) => byTier[(int)tier - 1];
}

/// <summary>
/// What a scroll rolls, and how often it comes up with nothing.
/// </summary>
/// <remarks>
/// The whole design lives in this one file as plain tables rather than in a csv. Every
/// number here is read by exactly one thing - the roll below - and a csv would have bought
/// nothing but a second place for the two to disagree. The design document these came from
/// is the other copy, and that one is for people.
/// </remarks>
public static class EnchantTables
{
    /// <summary>Odds are in ten thousandths, matching the forge.</summary>
    public const int ChanceScale = 10000;

    /// <summary>How many options each tier attempts. Index from Earth at zero.</summary>
    private static readonly int[] attemptsByTier = [1, 2, 2, 3];

    /// <summary>
    /// What one attempt can go wrong at, and how hard it is to roll high.
    /// </summary>
    /// <remarks>
    /// Difficulty comes in two steps rather than one, which is the whole shape of this.
    ///
    /// The first step is filling the rows at all. An attempt has a small chance of coming
    /// up empty, and the higher tiers - which attempt more rows - have a larger one, so a
    /// full legendary block of three is genuinely uncommon while an earth scroll almost
    /// always writes its single option.
    ///
    /// The second step is the number itself. A filled row is never worse than the bottom of
    /// its band, and every step above the bottom is rarer than the one below it. Curve is
    /// the exponent that does that: a roll of zero to one raised to it, then stretched
    /// across the band. One would be flat, and the higher it goes the more the results
    /// crowd against the floor. It climbs with the tier, so the good numbers on a legendary
    /// scroll are harder to reach than the good numbers on an earth one, on top of already
    /// being larger.
    ///
    /// Failing outright and getting nothing was the old shape and it punished beginners
    /// worst: an earth scroll rolls once, so its per-row failure was its whole failure.
    /// Now the floor is the minimum value and the gamble is how far above it you land.
    /// </remarks>
    private static readonly (int Empty, double Curve)[] oddsByTier =
    [
        (200, 1.5),  //Earth   2% empty
        (1200, 1.8), //Sky    12%
        (1800, 2.2), //Heaven 18%
        (2500, 2.6)  //Legend 25%
    ];

    private static readonly EnchantStat[] pool =
    [
        //The six anyone can roll on anything.
        new(CharacterStat.AddStr, EnchantSlotFamily.Any, [(1, 2), (2, 3), (3, 4), (4, 5)]),
        new(CharacterStat.AddAgi, EnchantSlotFamily.Any, [(1, 2), (2, 3), (3, 4), (4, 5)]),
        new(CharacterStat.AddVit, EnchantSlotFamily.Any, [(1, 2), (2, 3), (3, 4), (4, 5)]),
        new(CharacterStat.AddInt, EnchantSlotFamily.Any, [(1, 2), (2, 3), (3, 4), (4, 5)]),
        new(CharacterStat.AddDex, EnchantSlotFamily.Any, [(1, 2), (2, 3), (3, 4), (4, 5)]),
        new(CharacterStat.AddLuk, EnchantSlotFamily.Any, [(1, 2), (2, 3), (3, 4), (4, 5)]),

        //Offensive: what a weapon or a ring can carry.
        new(CharacterStat.AddAttackPower, EnchantSlotFamily.Offensive, [(0, 0), (5, 8), (10, 15), (18, 25)]),
        new(CharacterStat.AddMagicAttackPower, EnchantSlotFamily.Offensive, [(0, 0), (5, 8), (10, 15), (18, 25)]),
        new(CharacterStat.AspdBonus, EnchantSlotFamily.Offensive, [(0, 0), (1, 1), (2, 2), (3, 3)]),
        new(CharacterStat.AddHit, EnchantSlotFamily.Offensive, [(0, 0), (0, 0), (3, 4), (5, 7)]),
        new(CharacterStat.AddCrit, EnchantSlotFamily.Offensive, [(0, 0), (0, 0), (1, 2), (3, 4)]),
        new(CharacterStat.AddCritDamage, EnchantSlotFamily.Offensive, [(0, 0), (0, 0), (3, 5), (6, 10)]),

        //Defensive: what armour, a shield, a cape or a pair of boots can carry.
        new(CharacterStat.AddDef, EnchantSlotFamily.Defensive, [(0, 0), (1, 2), (3, 4), (5, 6)]),
        new(CharacterStat.AddMDef, EnchantSlotFamily.Defensive, [(0, 0), (1, 2), (3, 4), (5, 6)]),
        new(CharacterStat.AddMaxHp, EnchantSlotFamily.Defensive, [(0, 0), (50, 80), (100, 150), (200, 300)]),
        new(CharacterStat.MoveSpeedBonus, EnchantSlotFamily.Defensive, [(0, 0), (3, 3), (5, 5), (8, 8)]),
        new(CharacterStat.AddFlee, EnchantSlotFamily.Defensive, [(0, 0), (0, 0), (3, 4), (5, 7)]),
        new(CharacterStat.AddMaxSp, EnchantSlotFamily.Defensive, [(0, 0), (0, 0), (20, 30), (50, 80)])
    ];

    /// <summary>Scratch for the candidate list, so a roll allocates nothing.</summary>
    private static readonly List<EnchantStat> candidates = new(pool.Length);

    /// <summary>
    /// Which pool an item draws from, or None if it is not something that can be enchanted.
    /// </summary>
    /// <remarks>
    /// Read off the item rather than off the slot it happens to be in, because a scroll can
    /// be used on something sitting in the bag. A shield is armour here: it is in the armour
    /// table with an OffHand position, and what it wants is defence rather than attack.
    /// </remarks>
    public static EnchantSlotFamily FamilyOf(int itemId)
    {
        if (DataManager.WeaponInfo.ContainsKey(itemId))
            return EnchantSlotFamily.Weapon;

        if (DataManager.ArmorInfo.TryGetValue(itemId, out var armor))
            return armor.EquipPosition == EquipPosition.Accessory
                ? EnchantSlotFamily.Accessory
                : EnchantSlotFamily.Armour;

        return EnchantSlotFamily.None;
    }

    public static int AttemptsFor(EnchantTier tier) => attemptsByTier[(int)tier - 1];

    public static (int Empty, double Curve) OddsFor(EnchantTier tier) => oddsByTier[(int)tier - 1];

    /// <summary>
    /// One scroll's worth of rolling.
    /// </summary>
    /// <remarks>
    /// Each attempt is independent: it decides whether it writes a row at all first, and
    /// only then picks what goes in it. An empty attempt does not use up a stat, so an
    /// empty first row does not narrow the other two.
    ///
    /// The stat is drawn evenly from everything the slot and the tier allow and the item
    /// does not already have. Even, with no weighting toward anything - the odds of rolling
    /// strength on a mace are the odds of rolling intelligence on it.
    /// </remarks>
    public static ItemEnchant Roll(EnchantTier tier, EnchantSlotFamily family)
    {
        var enchant = new ItemEnchant(tier);

        if (tier == EnchantTier.None || family == EnchantSlotFamily.None)
            return enchant;

        var (empty, curve) = OddsFor(tier);
        var attempts = AttemptsFor(tier);

        for (var i = 0; i < attempts; i++)
        {
            if (GameRandom.Next(ChanceScale) < empty)
                continue; //this row stayed blank, and the item is none the worse for it

            candidates.Clear();
            foreach (var entry in pool)
            {
                if ((entry.Families & family) == 0)
                    continue;
                if (!entry.OfferedAt(tier))
                    continue;
                if (enchant.HasStat(entry.Stat))
                    continue;

                candidates.Add(entry);
            }

            if (candidates.Count == 0)
                break; //nothing left this slot can take, which three options cannot manage today

            var pick = candidates[GameRandom.Next(candidates.Count)];

            enchant.Add(pick.Stat, ValueFor(pick.Band(tier), curve));
        }

        return enchant;
    }

    /// <summary>
    /// A number from the band, crowded toward the bottom of it.
    /// </summary>
    /// <remarks>
    /// The floor is the minimum, always: a row that got written is never worse than the
    /// bottom of its band. Above that, a uniform roll raised to the curve leans the result
    /// down, so every point of the band is rarer than the point below it and the top of a
    /// wide band is a genuine find rather than a coin flip.
    ///
    /// A band with one value in it hands out that value and never touches the random.
    /// </remarks>
    private static int ValueFor((int Min, int Max) band, double curve)
    {
        if (band.Min >= band.Max)
            return band.Min;

        var t = Math.Pow(GameRandom.NextDouble(), curve);

        return band.Min + (int)Math.Round(t * (band.Max - band.Min), MidpointRounding.AwayFromZero);
    }
}
