using System.Collections.Generic;
using RebuildSharedData.Enum;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// The item on a market row, as it came off the wire.
    ///
    /// The four card slots only arrive for a unique item, matching what the server writes -
    /// most of a page of potions would otherwise be sixteen bytes of zero each.
    /// </summary>
    public class MarketItemView
    {
        public int ItemId;
        public int Count;
        public bool IsUnique;
        public int Refine;
        public readonly int[] Slots = new int[4];
    }

    /// <summary>One thing waiting in the parcel box.</summary>
    public class ParcelEntry
    {
        public int Id;
        public ParcelReason Reason;
        public string FromName = "";
        public int Zeny;
        public MarketItemView Item = new MarketItemView();

        /// <summary>Money only, which the window draws differently from an item.</summary>
        public bool IsMoneyOnly => Item.ItemId <= 0;
    }

    /// <summary>One listing on the board.</summary>
    public class AuctionEntry
    {
        public int Id;

        /// <summary>Whether this character is the seller, which decides which buttons show.</summary>
        public bool IsMine;

        public string SellerName = "";
        public MarketItemView Item = new MarketItemView();
        public int StartPrice;
        public int HighBid;
        public string HighBidderName = "";

        /// <summary>
        /// Seconds left when the packet was written, counted down locally after that.
        ///
        /// Sent as a length rather than a moment because the two machines do not agree on
        /// what time it is, and a clock three hours out reads as the feature being broken.
        /// </summary>
        public int SecondsLeft;

        /// <summary>What it would take to lead, worked out the same way the server does.</summary>
        public int MinimumBid => HighBid <= 0
            ? StartPrice
            : HighBid + (HighBid / 20 < 1 ? 1 : HighBid / 20);
    }

    /// <summary>One bid that was made on a listing, winning or not.</summary>
    public class AuctionBidEntry
    {
        public string BidderName = "";
        public int Amount;

        /// <summary>How long ago it was placed, in seconds when the packet was written.</summary>
        public int SecondsAgo;
    }

    /// <summary>One standing offer to buy something.</summary>
    public class BuyOrderEntry
    {
        public int Id;
        public string BuyerName = "";
        public int ItemId;
        public int WantedCount;
        public int RemainingCount;
        public int PricePer;
        public int SecondsLeft;

        /// <summary>What is still on the table, for somebody deciding whether to sell.</summary>
        public long RemainingValue => (long)RemainingCount * PricePer;
    }

    /// <summary>
    /// What this client knows about the market, which is only ever what the server said.
    ///
    /// Static and replaced wholesale by each answer, the same as GuildState: nothing here
    /// is worked out locally, and the window's job is to draw this and to ask for things.
    /// <see cref="Revision"/> is how the window notices - it keeps the number it last drew
    /// and rebuilds when it no longer matches, which avoids an event holding a reference to
    /// a window that may have been destroyed.
    /// </summary>
    public static class MarketState
    {
        /// <summary>How many parcels are waiting, whether or not the box has been opened.</summary>
        public static int ParcelsWaiting;

        /// <summary>Only filled once the box has actually been asked for.</summary>
        public static readonly List<ParcelEntry> Parcels = new List<ParcelEntry>();

        /// <summary>Whether the box's contents have ever come back, as against come back empty.</summary>
        public static bool ParcelsReceived;

        public static readonly List<AuctionEntry> Listings = new List<AuctionEntry>();
        public static bool ListingsReceived;
        public static int BrowsePage;
        public static int BrowseTotal;
        public static string BrowseSearch = "";

        /// <summary>What this character listed, and what they are currently leading.</summary>
        public static readonly List<AuctionEntry> Mine = new List<AuctionEntry>();
        public static bool MineReceived;

        /// <summary>The bids on whichever listing is open, newest first, and which one
        /// they belong to - so an answer arriving late for a listing nobody is looking at
        /// any more is ignored rather than drawn under the wrong item.</summary>
        public static readonly List<AuctionBidEntry> History = new List<AuctionBidEntry>();
        public static int HistoryFor = -1;

        /// <summary>What people are buying, and the orders this character posted.</summary>
        public static readonly List<BuyOrderEntry> BuyOrders = new List<BuyOrderEntry>();
        public static bool BuyOrdersReceived;
        public static int BuyPage;
        public static int BuyTotal;
        public static string BuySearch = "";

        public static readonly List<BuyOrderEntry> MyBuyOrders = new List<BuyOrderEntry>();
        public static bool MyBuyOrdersReceived;

        /// <summary>Bumped whenever anything above changes. The window watches this.</summary>
        public static int Revision;

        public static void Touch() => Revision++;

        /// <summary>Forgotten on log out, so the next character does not read the last one's.</summary>
        public static void Clear()
        {
            ParcelsWaiting = 0;
            Parcels.Clear();
            ParcelsReceived = false;
            Listings.Clear();
            ListingsReceived = false;
            BrowsePage = 0;
            BrowseTotal = 0;
            BrowseSearch = "";
            Mine.Clear();
            MineReceived = false;
            History.Clear();
            HistoryFor = -1;
            BuyOrders.Clear();
            BuyOrdersReceived = false;
            BuyPage = 0;
            BuyTotal = 0;
            BuySearch = "";
            MyBuyOrders.Clear();
            MyBuyOrdersReceived = false;
            Revision++;
        }
    }
}
