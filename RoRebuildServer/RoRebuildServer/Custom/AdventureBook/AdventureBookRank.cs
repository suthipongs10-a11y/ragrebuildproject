using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;

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

    /// <summary>Rank from stars, where the last rank asks for the book rather than a number.</summary>
    /// <remarks>
    /// The star threshold is asked for as well as every region, and that is not belt and
    /// braces. The regions are the ones the book was built with, and the book is built from
    /// the maps that loaded - so on a server running a handful of maps, "every region" is a
    /// far smaller claim than it sounds, and the last rank hands over a Valkyrie set. Asking
    /// for the stars too means a partial book cannot reach it, which is the right answer:
    /// the last rank is the whole book, and half a book is not the whole book.
    /// </remarks>
    public static int RankFor(int stars, bool everyRegionComplete)
    {
        if (everyRegionComplete && stars >= StarsForRank[StarsForRank.Length - 1])
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

    /// <summary>
    /// The star count this rank began at, which is where a bar towards the next one starts.
    /// </summary>
    /// <remarks>
    /// Without this the client can only draw progress as a share of the next threshold, so
    /// somebody at rank three with 180 of the 280 stars for rank four sees a bar two thirds
    /// full when they have barely started - which reads as the bar being wrong rather than as
    /// the rank being hard.
    /// </remarks>
    public static int StarsAtRank(int rank) => rank <= 0 ? 0 : StarsForRank[Math.Min(rank, StarsForRank.Length) - 1];

    /// <summary>What a rank is worth, all of it, rather than what the last rank added.</summary>
    public readonly record struct RankBonus(int Stats, int DropPercent, int ExpPercent, int RefinePercent);

    public static RankBonus BonusFor(int rank)
    {
        if (rank <= 0)
            return default;
        if (rank >= MaxRank)
            return new RankBonus(5, 12, 12, 8);

        return new RankBonus(
            Math.Min(rank, 3),
            Math.Clamp(rank - 3, 0, 3) * 3,
            Math.Clamp(rank - 6, 0, 3) * 3,
            Math.Clamp(rank - 6, 0, 3) * 2);
    }

    /// <summary>
    /// Lays the rank's bonuses over a player's freshly rebuilt stats.
    /// </summary>
    /// <remarks>
    /// Called from UpdateStats, right where the guild skills go on, and for the same reason
    /// the comment there gives: adding on gain and subtracting on loss is the version that
    /// leaks. UpdateStats has already set the base stats back to what the character actually
    /// has, so a rank that changes - or a book that gets switched off - simply stops being
    /// added rather than needing to be unwound.
    ///
    /// Refine chance is not a stat, so it is not applied here; the refine system asks for it
    /// at the moment somebody swings a hammer.
    /// </remarks>
    public static void ApplyTo(Player player)
    {
        if (!AdventureBookManager.IsEnabled || !AdventureBook.IsBuilt)
            return;

        var bonus = BonusFor(AdventureBookProgress.GetRank(player));
        if (bonus.Stats <= 0 && bonus.DropPercent <= 0 && bonus.ExpPercent <= 0)
            return;

        var ce = player.CombatEntity;

        if (bonus.Stats > 0)
        {
            ce.AddStat(CharacterStat.AddStr, bonus.Stats);
            ce.AddStat(CharacterStat.AddAgi, bonus.Stats);
            ce.AddStat(CharacterStat.AddVit, bonus.Stats);
            ce.AddStat(CharacterStat.AddInt, bonus.Stats);
            ce.AddStat(CharacterStat.AddDex, bonus.Stats);
            ce.AddStat(CharacterStat.AddLuk, bonus.Stats);
        }

        if (bonus.DropPercent > 0)
            ce.AddStat(CharacterStat.AddDropPercent, bonus.DropPercent);

        if (bonus.ExpPercent > 0)
            ce.AddStat(CharacterStat.AddExpPercent, bonus.ExpPercent);
    }

    /// <summary>The percentage points a player's rank adds to a refine attempt.</summary>
    public static int RefineBonusFor(Player player)
    {
        if (!AdventureBookManager.IsEnabled || !AdventureBook.IsBuilt)
            return 0;

        return BonusFor(AdventureBookProgress.GetRank(player)).RefinePercent;
    }
}
