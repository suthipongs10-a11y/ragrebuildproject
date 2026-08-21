namespace RebuildSharedData.Enum;

/// <summary>
/// What the buy order page is asking the server to do. Sent as the first byte of a
/// BuyOrderAction packet, the same shape the guild, trade and auction windows use.
/// </summary>
public enum BuyOrderRequestType : byte
{
    /// <summary>Show me what people are buying. Payload: string search, byte page.</summary>
    Browse,

    /// <summary>Show me the orders I posted.</summary>
    Mine,

    /// <summary>
    /// Post one. Payload: int itemId, int count, int pricePer.
    ///
    /// The whole cost leaves the purse now - the total plus the fee - because an order
    /// that is only checked against a purse is an order somebody can post five of with
    /// one purse's worth of zeny and then be unable to pay for.
    /// </summary>
    Create,

    /// <summary>Sell into one. Payload: int orderId, int bagId, int count.</summary>
    Sell,

    /// <summary>Take one of mine down. Payload: int orderId.</summary>
    Cancel,
}

/// <summary>What a BuyOrderData packet is carrying.</summary>
public enum BuyOrderDataType : byte
{
    /// <summary>A page of what people are buying.</summary>
    Orders,

    /// <summary>The orders this character posted.</summary>
    MyOrders,
}
