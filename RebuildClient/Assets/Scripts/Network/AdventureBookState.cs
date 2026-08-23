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
        public int MonsterId;
        public int RegionIndex;
        public string Name;
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
        public string RewardCode;
        public bool Complete;
        public readonly List<AdventureBookPage> Pages = new List<AdventureBookPage>();
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
        public static readonly Dictionary<int, AdventureBookPage> PagesByMonster = new Dictionary<int, AdventureBookPage>();

        public static int Rank;
        public static int Stars;
        public static int StarTotal;
        public static int StarsForNextRank;

        public static bool Received;
        public static int Revision;

        public static void Touch() => Revision++;

        public static void Clear()
        {
            Regions.Clear();
            PagesByMonster.Clear();
            Received = false;
        }
    }
}
