namespace RebuildSharedData.Enum;

/// <summary>What a player asks of a trade. One packet in, this byte at the front of it.</summary>
public enum TradeAction : byte
{
    /// <summary>Ask somebody to trade. Carries the entity id of who.</summary>
    Request,

    Accept,
    Decline,

    /// <summary>Put something in. Carries a bag id and how many.</summary>
    AddItem,

    /// <summary>Take something back out. Carries a bag id.</summary>
    RemoveItem,

    /// <summary>Set how much money is on the table. Carries the amount, not a change to it.</summary>
    SetZeny,

    /// <summary>
    /// Agree to what is on the table. Nothing moves yet, and either side changing what they
    /// are offering unlocks both again - which is the whole reason there are two steps.
    /// </summary>
    Lock,

    /// <summary>Both locked and both confirmed is the only way anything changes hands.</summary>
    Confirm,

    Cancel,
}

/// <summary>What the server tells a client about the trade it is in.</summary>
public enum TradeUpdateType : byte
{
    /// <summary>Somebody wants to trade with you. Carries their name.</summary>
    Requested,

    /// <summary>Both sides are now at the table. Carries the other one's name.</summary>
    Started,

    /// <summary>One side's offer, in full. Carries whose it is and everything on it.</summary>
    Offer,

    /// <summary>Who has agreed so far.</summary>
    LockChanged,

    /// <summary>It happened. The inventory updates that follow say what changed.</summary>
    Completed,

    /// <summary>It did not. Carries why, to be shown rather than guessed at.</summary>
    Cancelled,
}
