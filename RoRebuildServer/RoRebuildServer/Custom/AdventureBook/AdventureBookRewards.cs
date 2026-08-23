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
        AdventureBookReward Hunt,
        AdventureBookReward HuntLarge,
        AdventureBookReward Card);

    public static readonly Band[] Bands =
    {
        new(29,
            new AdventureBookReward("Concentration_Potion", 5),
            new AdventureBookReward("Old_Blue_Box", 1),
            new AdventureBookReward("Old_Card_Album", 1)),
        new(59,
            new AdventureBookReward("Awakening_Potion", 5),
            new AdventureBookReward("Old_Blue_Box", 2),
            new AdventureBookReward("Old_Card_Album", 1)),
        new(int.MaxValue,
            new AdventureBookReward("Berserk_Potion", 5),
            new AdventureBookReward("Old_Violet_Box", 1),
            new AdventureBookReward("Old_Card_Album", 2))
    };

    public static Band BandForLevel(int level)
    {
        foreach (var band in Bands)
            if (level <= band.MaxLevel)
                return band;

        return Bands[^1];
    }

    public static AdventureBookReward For(int level, AdventureBookStars star)
    {
        var band = BandForLevel(level);
        return star switch
        {
            AdventureBookStars.Hunt => band.Hunt,
            AdventureBookStars.HuntLarge => band.HuntLarge,
            AdventureBookStars.Card => band.Card,
            _ => default
        };
    }
}
