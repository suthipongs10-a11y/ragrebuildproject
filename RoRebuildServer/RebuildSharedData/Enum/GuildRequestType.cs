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
}
