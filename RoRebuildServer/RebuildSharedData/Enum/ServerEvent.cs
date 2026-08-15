namespace RebuildSharedData.Enum;

public enum ServerEvent
{
    None = 0,
    TradeSuccess,
    NoAmmoEquipped,
    WrongAmmoEquipped,
    OutOfAmmo,
    GetZeny,
    GetMVP,
    EligibleForJobChange,
    MemoLocationSaved,
    //a line worth the whole server stopping to read, shown across the top of the screen
    //rather than only in the chat log. Carries its text in the packet's string field.
    Announcement,
}

public enum ServerResult
{
    PartyInviteSent,
    InviteFailedSenderNoBasicSkill,
    InviteFailedRecipientNoBasicSkill,
    InviteFailedAlreadyInParty,
}