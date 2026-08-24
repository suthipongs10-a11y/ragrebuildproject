using RoRebuildServer.Data;

namespace RoRebuildServer.Custom.AdventureBook;

/// <summary>What one item of a reward is: what, and how many.</summary>
public readonly record struct AdventureBookReward(string Code, int Count)
{
    /// <summary>The item id, or 0 when the code names nothing - which is a content bug worth seeing.</summary>
    public int ItemId => DataManager.ItemIdByName.TryGetValue(Code, out var id) ? id : 0;
}

/// <summary>
/// What a star pays, by how dangerous the thing that had to die was.
/// </summary>
/// <remarks>
/// One table, read both by the code that hands the reward over and by the code that tells the
/// client what to draw. Two tables would drift, and the one that drifts is always the one the
/// window shows - which is worse than showing nothing, because it is a promise.
///
/// Level rather than region, so a stray high level monster on a beginner map is worth what it
/// costs to kill. Nothing here pays zeny on purpose: money can be earned any number of ways
/// already, and the point of the book is to hand over things that cannot.
/// </remarks>
public static class AdventureBookRewards
{
    public readonly record struct Band(
        int MaxLevel,
        AdventureBookReward[] Hunt,
        AdventureBookReward[] HuntLarge,
        AdventureBookReward[] Card);

    /// <summary>
    /// The ore every star pays on top of whatever else it pays.
    /// </summary>
    /// <remarks>
    /// Refining ore rather than more potions, because ore is the one thing on this server that
    /// everybody wants and nobody has enough of - and unlike zeny it cannot be farmed by
    /// standing somewhere convenient. One at a star, two when a card is involved.
    /// </remarks>
    private static AdventureBookReward Elunium(int count) => new("Elunium", count);
    private static AdventureBookReward Oridecon(int count) => new("Oridecon", count);

    public static readonly Band[] Bands =
    {
        new(29,
            new[] { new AdventureBookReward("Concentration_Potion", 5), Elunium(1) },
            new[] { new AdventureBookReward("Old_Blue_Box", 1), Oridecon(1) },
            new[] { new AdventureBookReward("Old_Card_Album", 1), Elunium(2), Oridecon(2) }),
        new(59,
            new[] { new AdventureBookReward("Awakening_Potion", 5), Elunium(1) },
            new[] { new AdventureBookReward("Old_Blue_Box", 2), Oridecon(1) },
            new[] { new AdventureBookReward("Old_Card_Album", 1), Elunium(2), Oridecon(2) }),
        new(int.MaxValue,
            new[] { new AdventureBookReward("Berserk_Potion", 5), Elunium(1) },
            new[] { new AdventureBookReward("Old_Purple_Box", 1), Oridecon(1) },
            new[] { new AdventureBookReward("Old_Card_Album", 2), Elunium(2), Oridecon(2) })
    };

    /// <summary>The most items any one star pays, so the wire format can be sized.</summary>
    public const int MaxItemsPerStar = 3;

    /// <summary>
    /// What reaching a rank pays, once, on the way up.
    /// </summary>
    /// <remarks>
    /// Written out rank by rank rather than as a formula, because these are the numbers most
    /// likely to be argued about later and a table can be argued with. Index zero is rank one.
    ///
    /// Battle Manual and Bubble Gum are here for a reason beyond generosity: both had sat in
    /// the item tables since the beginning with no effect at all, and a rank reward is a
    /// better reason to finally write one than a wishlist is.
    /// </remarks>
    public static readonly AdventureBookReward[][] RankRewards =
    {
        //1
        new[] { Elunium(5), Oridecon(5), Manual(1), Gum(1) },
        //2
        new[] { Elunium(10), Oridecon(10), Manual(2), Gum(2) },
        //3
        new[] { Elunium(15), Oridecon(15), Manual(3), Gum(3) },
        //4
        new[] { Elunium(20), Oridecon(20), Manual(4), Gum(4), new AdventureBookReward("Old_Purple_Box", 3) },
        //5
        new[] { Elunium(30), Oridecon(30), Manual(5), Gum(5), new AdventureBookReward("Old_Purple_Box", 5) },
        //6
        new[] { Elunium(40), Oridecon(40), Manual(6), Gum(6), new AdventureBookReward("Old_Card_Album", 3) },
        //7
        new[] { Elunium(50), Oridecon(50), Manual(8), Gum(8), new AdventureBookReward("Old_Card_Album", 5) },
        //8
        new[] { Elunium(70), Oridecon(70), Manual(10), Gum(10), new AdventureBookReward("Old_Card_Album", 8) },
        //9
        new[] { Elunium(100), Oridecon(100), Manual(15), Gum(15), new AdventureBookReward("Old_Card_Album", 12) },
        //10 - the whole point of the book
        new[]
        {
            new AdventureBookReward("Valkyrian_Helm", 1),
            new AdventureBookReward("Valkyrian_Armor", 1),
            new AdventureBookReward("Valkyrian_Manteau", 1),
            new AdventureBookReward("Valkyrian_Shoes", 1),
            new AdventureBookReward("Valkyrja's_Shield", 1),
            Elunium(150), Oridecon(150)
        }
    };

    private static AdventureBookReward Manual(int count) => new("Battle_Manual", count);
    private static AdventureBookReward Gum(int count) => new("Bubble_Gum", count);

    /// <summary>What reaching this rank pays, or nothing when the rank pays nothing.</summary>
    public static AdventureBookReward[] ForRank(int rank) =>
        rank >= 1 && rank <= RankRewards.Length ? RankRewards[rank - 1] : Array.Empty<AdventureBookReward>();

    public static Band BandForLevel(int level)
    {
        foreach (var band in Bands)
            if (level <= band.MaxLevel)
                return band;

        return Bands[^1];
    }

    public static AdventureBookReward[] For(int level, AdventureBookStars star)
    {
        var band = BandForLevel(level);
        return star switch
        {
            AdventureBookStars.Hunt => band.Hunt,
            AdventureBookStars.HuntLarge => band.HuntLarge,
            AdventureBookStars.Card => band.Card,
            _ => Array.Empty<AdventureBookReward>()
        };
    }
}
