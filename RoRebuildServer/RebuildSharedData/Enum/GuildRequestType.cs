namespace RebuildSharedData.Enum;

/// <summary>
/// What the guild window is asking the server to do. Sent as the first byte of a
/// GuildAction packet, so the client and server only have to agree on one packet shape
/// rather than one per button.
/// </summary>
public enum GuildRequestType : byte
{
    /// <summary>Send me my guild and its roster again.</summary>
    Refresh,

    /// <summary>Send me every guild that can be joined.</summary>
    ListGuilds,

    /// <summary>Ask a guild, by id, to let me in.</summary>
    RequestJoin,

    /// <summary>Take my own name off the roster.</summary>
    Leave,

    /// <summary>Leader only: take the named member off the roster.</summary>
    Kick,

    /// <summary>Leader only: let the named applicant in.</summary>
    ApproveRequest,

    /// <summary>Leader only: turn the named applicant away.</summary>
    RejectRequest,

    /// <summary>Leader only: set the guild's title, which every member wears.</summary>
    SetTitle,

    /// <summary>Leader only: choose the guild's emblem, by its number in the list.</summary>
    SetEmblem,

    /// <summary>Any member: hand a stack of items to the guild for contribution points.</summary>
    Donate,

    /// <summary>Leader only: spend a point raising one of the guild's skills.</summary>
    LearnSkill,
}

/// <summary>
/// What the server is answering with, sent as the first byte of a GuildData packet.
/// </summary>
public enum GuildDataType : byte
{
    /// <summary>Your guild, its roster, and anyone waiting to be let in.</summary>
    MyGuild,

    /// <summary>The list of guilds you could ask to join.</summary>
    GuildList,

    /// <summary>
    /// Something the whole guild should hear, already written out.
    ///
    /// Free text on the guild's own packet rather than another entry in the event enum:
    /// what is being said is a name, a count and a number, and an enum would mean the
    /// client rebuilding the sentence from parts it has to be sent anyway.
    /// </summary>
    Announcement,
}
