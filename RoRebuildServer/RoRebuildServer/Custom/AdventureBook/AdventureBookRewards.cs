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
            new[] { new AdventureBookReward("Old_Violet_Box", 1), Oridecon(1) },
            new[] { new AdventureBookReward("Old_Card_Album", 2), Elunium(2), Oridecon(2) })
    };

    /// <summary>The most items any one star pays, so the wire format can be sized.</summary>
    public const int MaxItemsPerStar = 3;

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
