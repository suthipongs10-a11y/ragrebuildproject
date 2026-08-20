namespace RebuildSharedData.Enum;

/// <summary>
/// What the parcel box is asking the server to do. Sent as the first byte of an
/// InboxAction packet, the same shape the guild and trade windows use.
/// </summary>
public enum InboxRequestType : byte
{
    /// <summary>Send me what is waiting for me.</summary>
    Refresh,

    /// <summary>Take one parcel, by its number. Payload: int parcelId.</summary>
    Claim,

    /// <summary>Take everything that will fit. Nothing is taken if nothing fits.</summary>
    ClaimAll,
}

/// <summary>What an InboxData packet is carrying.</summary>
public enum InboxDataType : byte
{
    /// <summary>The whole box, replacing whatever the window was showing.</summary>
    Contents,

    /// <summary>Only the count, for the badge on the button. Payload: short waiting.</summary>
    Count,
}

/// <summary>
/// Why a parcel was sent, which is the whole of what the window says about it. Kept as a
/// number rather than a sentence so the wording lives on one side and can be translated
/// without the server knowing about it.
/// </summary>
public enum ParcelReason : byte
{
    /// <summary>An auction ended and this is what was bid for it, less the cut.</summary>
    AuctionSold,

    /// <summary>An auction ended with no bids, so here is the item back.</summary>
    AuctionExpired,

    /// <summary>An auction was won. This is the item.</summary>
    AuctionWon,

    /// <summary>Somebody bid higher, so here is the money back.</summary>
    AuctionOutbid,

    /// <summary>A listing was taken down before it ended.</summary>
    AuctionCancelled,

    /// <summary>A buy order was filled and this is what was bought.</summary>
    BuyOrderFilled,

    /// <summary>A buy order was taken down or ran out, so here is what is left of it.</summary>
    BuyOrderClosed,

    /// <summary>Something was sold into somebody's buy order.</summary>
    BuyOrderSold,
}
