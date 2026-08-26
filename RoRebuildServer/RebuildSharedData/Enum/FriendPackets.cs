namespace RebuildSharedData.Enum;

/// <summary>What the client is asking the friend list to do.</summary>
public enum FriendRequestType : byte
{
    /// <summary>Remember somebody, by the name shown over their head.</summary>
    Add,

    /// <summary>Forget one, by the entry id the list was sent with.</summary>
    Remove,

    /// <summary>Send the whole list again, with everyone's job, level, guild and whether they are on.</summary>
    Refresh,

    /// <summary>
    /// Say something to one person by name.
    /// </summary>
    /// <remarks>
    /// Keyed by name rather than by an entry id, because the useful half of a private
    /// message is answering one from somebody who is not on the list yet.
    /// </remarks>
    Whisper,
}

/// <summary>What the server is telling the friend list.</summary>
public enum FriendDataType : byte
{
    /// <summary>The whole list, which is what a window opens on.</summary>
    FullList,

    /// <summary>
    /// One entry changed - somebody logged in or out, or levelled, or joined a guild.
    /// </summary>
    /// <remarks>
    /// Its own message rather than resending the list, because a busy evening is a great
    /// many people coming and going and a list of fifty sent each time is fifty times the
    /// traffic for one line that moved.
    /// </remarks>
    Status,

    /// <summary>A private message, either one that arrived or the echo of one sent.</summary>
    Whisper,

    /// <summary>Something did not work, said in words the player can read.</summary>
    Notice,
}
