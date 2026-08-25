using System.Collections.Generic;

namespace Assets.Scripts.Network
{
    /// <summary>Somewhere a monster stands, and how many of it are there.</summary>
    public struct AdventureBookSighting
    {
        public string Map;
        public int Count;
    }

    /// <summary>One page of the adventure book, as far as the client needs to draw it.</summary>
    public class AdventureBookPage
    {
        /// <summary>What the server calls this page: a card's item id, or a monster's id when it drops none.</summary>
        public int PageId;

        public int RegionIndex;
        public string Name;

        /// <summary>The monsters this page covers, when it covers more than one. Empty otherwise.</summary>
        public string Members;

        public int Level;
        public List<AdventureBookSighting> Sightings;
        public int HuntTarget;
        public int HuntTargetLarge;
        public int CardItemId;
        public int Kills;
        public int Stars;

        public bool HasHunt => (Stars & 1) != 0;
        public bool HasHuntLarge => (Stars & 2) != 0;
        public bool HasCard => (Stars & 4) != 0;

        /// <summary>How many stars this page can hold. A monster with no card tops out at two.</summary>
        public int MaxStars => CardItemId > 0 ? 3 : 2;

        public int StarCount
        {
            get
            {
                var n = 0;
                if (HasHunt) n++;
                if (HasHuntLarge) n++;
                if (HasCard) n++;
                return n;
            }
        }

        public bool IsComplete => StarCount >= MaxStars;
    }

    public class AdventureBookRegionInfo
    {
        public string Name;

        /// <summary>The headgear finishing this region hands over. The client owns the item table, so this is enough for a name and an icon.</summary>
        public int RewardItemId;

        public bool Complete;
        public readonly List<AdventureBookPage> Pages = new List<AdventureBookPage>();
    }

    /// <summary>What one star pays: an item and how many of it.</summary>
    public struct AdventureBookReward
    {
        public int ItemId;
        public int Count;

        public bool HasItem => ItemId > 0 && Count > 0;
    }

    /// <summary>
    /// What the three stars pay for pages up to a given level.
    /// </summary>
    /// <remarks>
    /// Sent once rather than attached to every page, because a reward depends only on the
    /// page's level. The client picks the band itself.
    /// </remarks>
    public struct AdventureBookRewardBand
    {
        public int MaxLevel;
        public List<AdventureBookReward> Hunt;
        public List<AdventureBookReward> HuntLarge;
        public List<AdventureBookReward> Card;
    }

    /// <summary>One thing the MVP box can give, and how often relative to the rest.</summary>
    public struct BoxEntry
    {
        public int ItemId;
        public int Weight;
    }

    /// <summary>One boss in the hunter's log, and whether this character has met it.</summary>
    public class BossLogPage
    {
        public int MonsterId;
        public string Name;
        public int Level;
        public bool IsMvp;
        public int Kills;
        public List<string> Maps;

        public bool Found => Kills > 0;
    }

    /// <summary>
    /// One rung of the Adventure rank ladder: what it costs, what it is worth, what it pays.
    /// </summary>
    public struct AdventureBookRankInfo
    {
        public int Stars;
        public int StatBonus;
        public int DropPercent;
        public int ExpPercent;
        public int RefinePercent;
        public List<AdventureBookReward> Rewards;
    }

    /// <summary>
    /// The adventure book as the client holds it.
    /// </summary>
    /// <remarks>
    /// Static and rebuilt from the wire, the same shape MarketState uses and for the same
    /// reason: the window is created and destroyed, and an event holding a reference to a
    /// destroyed window is a null reference a frame later. <see cref="Revision"/> is how the
    /// window notices something changed - it keeps the number it last drew and redraws when
    /// the two no longer match.
    ///
    /// Only what the server alone knows lives here. Monster names and the maps each one
    /// stands on come from the data the client loaded at startup, so they are looked up
    /// rather than sent.
    /// </remarks>
    public static class AdventureBookState
    {
        public static readonly List<AdventureBookRegionInfo> Regions = new List<AdventureBookRegionInfo>();
        public static readonly Dictionary<int, AdventureBookPage> PagesById = new Dictionary<int, AdventureBookPage>();

        public static readonly List<AdventureBookRewardBand> Bands = new List<AdventureBookRewardBand>();

        /// <summary>The rank ladder, index zero being rank one.</summary>
        public static readonly List<AdventureBookRankInfo> Ranks = new List<AdventureBookRankInfo>();

        /// <summary>Every boss in the world, MVPs first.</summary>
        public static readonly List<BossLogPage> Bosses = new List<BossLogPage>();
        public static readonly Dictionary<int, BossLogPage> BossesById = new Dictionary<int, BossLogPage>();

        public static int BossTotal;
        public static int BossMvpTotal;
        public static int BossFound;
        public static bool BossCleared;
        public static int BossMvpKills;
        public static int BossPlainHatId;
        public static int BossCrownedHatId;

        /// <summary>The box the slotted hat comes out of, which is not the log's to give.</summary>
        public static int BossBoxItemId;

        /// <summary>What the MVP box holds, commonest first, and the weights added up.</summary>
        public static readonly List<BoxEntry> BoxContents = new List<BoxEntry>();
        public static int BoxWeightTotal;

        /// <summary>Whether the log arrived at all. It is a separate switch on the server.</summary>
        public static bool HasBossLog;

        public static int Rank;
        public static int Stars;
        public static int StarTotal;
        public static int StarsForNextRank;

        /// <summary>Where the current rank began, so the bar measures the stretch actually being walked.</summary>
        public static int StarsAtRank;

        public static bool Received;
        public static int Revision;

        public static void Touch() => Revision++;

        private static readonly List<AdventureBookReward> NoRewards = new List<AdventureBookReward>();

        /// <summary>What a page of this level pays for one of its stars.</summary>
        public static List<AdventureBookReward> RewardFor(int level, int starIndex)
        {
            if (Bands.Count == 0)
                return NoRewards;

            var band = Bands[Bands.Count - 1];
            for (var i = 0; i < Bands.Count; i++)
            {
                if (level > Bands[i].MaxLevel)
                    continue;
                band = Bands[i];
                break;
            }

            switch (starIndex)
            {
                case 0: return band.Hunt ?? NoRewards;
                case 1: return band.HuntLarge ?? NoRewards;
                case 2: return band.Card ?? NoRewards;
                default: return NoRewards;
            }
        }

        public static void Clear()
        {
            Regions.Clear();
            PagesById.Clear();
            Bands.Clear();
            Ranks.Clear();
            Received = false;
        }

        /// <summary>
        /// The boss log is cleared on its own header, not on the book's.
        /// </summary>
        /// <remarks>
        /// The two arrive as separate sections of the same reply and either can be switched
        /// off on the server. Clearing one from the other's header would empty whichever
        /// happened to arrive first.
        /// </remarks>
        public static void ClearBossLog()
        {
            Bosses.Clear();
            BossesById.Clear();
            BoxContents.Clear();
            BoxWeightTotal = 0;
            HasBossLog = false;
        }
    }
}
