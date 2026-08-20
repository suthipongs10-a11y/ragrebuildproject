namespace RebuildSharedData.Enum;

/// <summary>
/// What the auction window is asking the server to do. Sent as the first byte of an
/// AuctionAction packet, the same shape the guild and trade windows use.
/// </summary>
public enum AuctionRequestType : byte
{
    /// <summary>Send me what is up for auction. Payload: string search, byte page.</summary>
    Browse,

    /// <summary>Send me what I listed and what I am bidding on.</summary>
    Mine,

    /// <summary>
    /// Put something up. Payload: int bagId, int count, int startPrice, byte hours.
    /// </summary>
    Create,

    /// <summary>Bid on one. Payload: int auctionId, int bid.</summary>
    Bid,

    /// <summary>Take one of mine down. Payload: int auctionId.</summary>
    Cancel,
}

/// <summary>What an AuctionData packet is carrying.</summary>
public enum AuctionDataType : byte
{
    /// <summary>A page of listings, replacing what the window was showing.</summary>
    Listings,

    /// <summary>The listings this character has a stake in, listed or bid on.</summary>
    MyListings,

    /// <summary>One listing changed - somebody bid, or it went away.</summary>
    Updated,
}
