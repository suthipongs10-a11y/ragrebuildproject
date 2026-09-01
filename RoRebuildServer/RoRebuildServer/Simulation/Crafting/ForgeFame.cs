namespace RoRebuildServer.Simulation.Crafting;

/// <summary>
/// What a smith's name is worth on a weapon they made.
/// </summary>
/// <remarks>
/// Cards come off monsters, so anybody who hunts long enough gets one. An elemental weapon
/// has to come from a person, and until now there was no reason to care which person -
/// every smith's Fire Claymore was the same Fire Claymore. This is the thing a card cannot
/// have: a maker.
///
/// Points are the square of the weapon level, not the number of weapons, because counting
/// weapons rewards the wrong behaviour. A smith who turns out a thousand Maces would
/// outrank one who made eighty Fire Claymores, and the Mace takes four times the odds and
/// a tenth of the materials. Squaring it makes a level three worth nine level ones, which
/// is roughly what it costs.
///
/// A weapon with neither a stone nor a crumb earns nothing at all. That is the other half
/// of the same guard: the cheapest thing a smith can do in bulk is the thing this must not
/// pay for, and the ore recipes are cheaper still.
/// </remarks>
public static class ForgeFame
{
    public const int MaxRank = 4;

    /// <summary>Points needed to reach rank one, two, three and four.</summary>
    /// <remarks>
    /// Nine hundred is a hundred level three weapons that were worth making, which at the
    /// odds a fully trained smith rolls - fifty percent once a stone and three crumbs have
    /// been taken off - is about two hundred attempts. It is meant to be a season's work
    /// rather than an afternoon's, because a title nobody has to earn says nothing.
    /// </remarks>
    private static readonly int[] pointsForRank = [50, 150, 400, 900];

    /// <summary>Attack the weapon carries because of who made it. Index is the rank.</summary>
    /// <remarks>
    /// Small on purpose. This is the reason to seek out one smith rather than another, not
    /// the reason to use the weapon at all - the crumbs and the element are still the bulk
    /// of it. Fifteen sounds like nothing until it goes through Bowling Bash, which lands
    /// twice at five times the damage and turns it into a hundred and fifty.
    /// </remarks>
    private static readonly int[] attackForRank = [0, 3, 6, 10, 15];

    /// <summary>What one finished weapon adds to the smith's standing.</summary>
    public static int PointsFor(int weaponLevel, bool boundElement, int starCrumbs)
    {
        if (!boundElement && starCrumbs <= 0)
            return 0;

        var level = int.Clamp(weaponLevel, 1, 4);
        return level * level;
    }

    public static int RankFor(int points)
    {
        var rank = 0;

        for (var i = 0; i < pointsForRank.Length; i++)
        {
            if (points >= pointsForRank[i])
                rank = i + 1;
        }

        return rank;
    }

    /// <summary>Points still to go, or zero at the top.</summary>
    public static int PointsForNextRank(int rank) =>
        rank >= MaxRank ? 0 : pointsForRank[int.Clamp(rank, 0, MaxRank - 1)];

    public static int AttackBonusForRank(int rank) => attackForRank[int.Clamp(rank, 0, MaxRank)];
}
