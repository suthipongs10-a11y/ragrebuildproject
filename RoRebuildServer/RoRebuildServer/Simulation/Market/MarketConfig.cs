namespace RoRebuildServer.Simulation.Market;

/// <summary>
/// Every number the market runs on, in one place.
///
/// Here rather than spread through the handlers because these are the things that get
/// tuned after watching people use it, and a fee that appears in three files is a fee
/// that ends up different in three files.
/// </summary>
public static class MarketConfig
{
    /// <summary>Paid when a listing goes up, whether or not it sells. Keeps the board from
    /// filling with things nobody meant to sell.</summary>
    public const int ListingFeePercent = 1;

    /// <summary>The smallest listing fee, so a one zeny listing still costs something.</summary>
    public const int MinimumListingFee = 10;

    /// <summary>Taken out of what the seller is paid once something sells.</summary>
    public const int SaleCutPercent = 3;

    /// <summary>How long a listing may run, in hours. The client offers exactly these.</summary>
    public static readonly int[] DurationChoices = { 8, 24, 48 };

    /// <summary>Nothing may be listed for less than this, so the fee is never rounded away.</summary>
    public const int MinimumPrice = 10;

    /// <summary>The most anything may be listed or bid for. Zeny is a 32 bit number and the
    /// escrow has to be able to hold it without wrapping.</summary>
    public const int MaximumPrice = 1_000_000_000;

    /// <summary>A bid has to beat the standing one by this much, or by one zeny, whichever
    /// is more. Without it two people can raise each other by a zeny for an hour.</summary>
    public const int MinimumBidRaisePercent = 5;

    /// <summary>How many listings one character may have running at once.</summary>
    public const int MaxListingsPerCharacter = 10;

    /// <summary>How many parcels may wait for one character before the box refuses more.
    /// It never actually refuses - the parcel is written anyway, since the alternative is
    /// destroying somebody's winnings - but the window nags above this.</summary>
    public const int InboxSoftLimit = 50;

    /// <summary>How many listings one page of the browser holds.</summary>
    public const int BrowsePageSize = 20;

    /// <summary>How often the server looks for auctions that have run out, in seconds.
    /// A listing may therefore pay out a few seconds late, which nobody can tell.</summary>
    public const float SettleIntervalSeconds = 15f;

    //--- standing offers to buy -----------------------------------------------

    /// <summary>
    /// Paid on top of the money set aside, when an order is posted.
    ///
    /// Higher than the auction's listing fee, and on purpose: an auction that nobody bids
    /// on gives the item back and costs its owner a percent, while a buy order that nobody
    /// fills has held somebody's money out of the economy for a week. The fee is what makes
    /// posting one a decision.
    /// </summary>
    public const int BuyOrderFeePercent = 5;

    /// <summary>How long an order stands before what is left of it is given back.</summary>
    public const int BuyOrderDurationDays = 7;

    /// <summary>How many orders one character may have standing at once.</summary>
    public const int MaxBuyOrdersPerCharacter = 10;

    /// <summary>The most of one thing a single order may ask for.</summary>
    public const int MaxBuyOrderCount = 5000;

    /// <summary>What posting an order costs on top of the money it sets aside.</summary>
    public static int BuyOrderFee(int pricePer, int count)
    {
        var total = (long)pricePer * count;
        var fee = total * BuyOrderFeePercent / 100;
        return (int)Math.Min(fee < MinimumListingFee ? MinimumListingFee : fee, int.MaxValue);
    }

    /// <summary>
    /// Everything posting an order takes out of the purse: what it may pay out, plus the
    /// fee. Returns false when that will not fit in a zeny value at all.
    /// </summary>
    public static bool TryBuyOrderCost(int pricePer, int count, out int total, out int fee)
    {
        total = 0;
        fee = 0;

        if (pricePer < MinimumPrice || count <= 0 || count > MaxBuyOrderCount)
            return false;

        var held = (long)pricePer * count;
        var charge = held + BuyOrderFee(pricePer, count);
        if (held > MaximumPrice || charge > int.MaxValue)
            return false;

        total = (int)held;
        fee = BuyOrderFee(pricePer, count);
        return true;
    }

    /// <summary>What listing something costs, given what it starts at.</summary>
    public static int ListingFee(int startPrice)
    {
        var fee = (int)((long)startPrice * ListingFeePercent / 100);
        return fee < MinimumListingFee ? MinimumListingFee : fee;
    }

    /// <summary>What the seller actually receives out of a winning bid.</summary>
    public static int SellerProceeds(int winningBid)
    {
        var cut = (int)((long)winningBid * SaleCutPercent / 100);
        var paid = winningBid - cut;
        return paid < 0 ? 0 : paid;
    }

    /// <summary>The smallest bid that would take the lead on a listing.</summary>
    public static int MinimumBid(int startPrice, int highBid)
    {
        if (highBid <= 0)
            return startPrice; //the first bid may simply match the asking price

        var raise = (int)((long)highBid * MinimumBidRaisePercent / 100);
        if (raise < 1)
            raise = 1;

        var wanted = (long)highBid + raise;
        return wanted > MaximumPrice ? MaximumPrice : (int)wanted;
    }
}
