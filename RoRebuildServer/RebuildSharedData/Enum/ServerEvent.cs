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
    //something a card gave the wearer. Carries the item's name in the string field, or
    //nothing at all when what was found was zeny, in which case the amount is in the value.
    CardBonus,
    //ore a blacksmith turned up on a kill through Ore Discovery. Carries the item's name.
    OreDiscovery,
}

public enum ServerResult
{
    PartyInviteSent,
    InviteFailedSenderNoBasicSkill,
    InviteFailedRecipientNoBasicSkill,
    InviteFailedAlreadyInParty,
}