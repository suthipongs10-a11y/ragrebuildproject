namespace RebuildSharedData.Enum;

/// <summary>What the client is asking the adventure book for.</summary>
public enum AdventureBookRequestType : byte
{
    /// <summary>Send me the book and where I am in it.</summary>
    Refresh,

    /// <summary>Take me to a map this monster stands on. Followed by the monster id and the map name.</summary>
    Warp,
}

/// <summary>What the server is answering with.</summary>
public enum AdventureBookDataType : byte
{
    /// <summary>The whole book: regions, pages, and this character's progress through it.</summary>
    Book,

    /// <summary>One page moved. Cheaper than resending the book every time a star lands.</summary>
    PageUpdate,
}

/// <summary>Why a request to be taken somewhere was turned down.</summary>
public enum AdventureBookWarpDenial : byte
{
    Allowed,

    /// <summary>The first star of that page has not been earned, so the road is not open yet.</summary>
    NoStar,

    /// <summary>Not enough zeny for the fare.</summary>
    NoZeny,

    /// <summary>That monster does not stand on that map, so the client asked for something it made up.</summary>
    NotThere,

    /// <summary>The book is switched off, or the monster is not in it.</summary>
    Unknown,
}
