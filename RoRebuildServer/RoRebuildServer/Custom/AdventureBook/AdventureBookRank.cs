namespace RoRebuildServer.Custom.AdventureBook;

/// <summary>
/// Turns a pile of stars into the number people actually say out loud.
/// </summary>
/// <remarks>
/// The thresholds are fixed rather than a share of the book's size on purpose. A share would
/// mean that adding a region later quietly raised the bar for everybody, and somebody who had
/// been rank six for a month would log in as rank five having done nothing wrong. Fixed
/// numbers only ever get easier as content is added, which is the right direction for a
/// mistake to point.
///
/// Sized against a book of roughly seven hundred and thirty stars, which is what the current
/// content builds to. If the book ever doubles these want revisiting, but nobody loses a rank
/// in the meantime.
/// </remarks>
public static class AdventureBookRank
{
    public const int MaxRank = 10;

    private static readonly int[] StarsForRank = { 30, 90, 175, 280, 390, 490, 580, 650, 700 };

    /// <summary>Rank from stars, where the last rank is not for sale at any number of them.</summary>
    public static int RankFor(int stars, bool everyRegionComplete)
    {
        if (everyRegionComplete)
            return MaxRank;

        var rank = 0;
        for (var i = 0; i < StarsForRank.Length; i++)
        {
            if (stars < StarsForRank[i])
                break;
            rank = i + 1;
        }

        return rank;
    }

    /// <summary>How many stars the next rank asks for, or 0 when there is no next rank to reach.</summary>
    public static int StarsForNextRank(int currentRank) =>
        currentRank >= StarsForRank.Length ? 0 : StarsForRank[currentRank];
}
