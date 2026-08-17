namespace RebuildSharedData.Enum;

public enum PartyUpdateType
{
    AddPlayer,
    RemovePlayer,
    UpdatePlayer,
    LogIn,
    LogOut,
    ChangeLeader,
    LeaveParty,
    DisbandParty,
    UpdateHpSp,
    UpdateMap,

    /// <summary>The whole roster again, for a window that has just been opened.</summary>
    FullRefresh,

    /// <summary>The leader has turned experience sharing on or off.</summary>
    ChangeExpShare,
}

public enum PartyClientAction
{
    LeaveParty,
    ChangeLeader,
    RemovePlayer,
    DisbandParty,

    /// <summary>Send me the roster again. Kill counts move without anything else changing.</summary>
    RequestInfo,

    /// <summary>Leader only: share experience among the party, or let each keep their own.</summary>
    SetExpShare,
}