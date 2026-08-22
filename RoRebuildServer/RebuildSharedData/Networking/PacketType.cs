namespace RebuildSharedData.Networking;

public class ServerOnlyPacketAttribute : Attribute
{
}

public enum PacketType : byte
{
    //this set of packets all run on the main thread
    PlayerReady,
    EnterServer,
    Ping,
    DeleteCharacter,

    CreateParty,
    InvitePartyMember,
    AcceptPartyInvite,
    UpdateParty,
    NotifyPlayerPartyChange,

    AdminCharacterAction,
    AdminRequestMove,
    AdminServerAction,
    AdminLevelUp,
    AdminEnterServerSpecificMap,
    AdminChangeAppearance,
    AdminSummonMonster,
    AdminHideCharacter,
    AdminChangeSpeed,
    AdminFindTarget,
    AdminResetSkills,
    AdminResetStats,
    AdminCreateItem,

    //packets after this point are handled by the instance the player is on
    InstancePacketHandlerStart,

    [ServerOnlyPacket] ConnectionApproved,
    [ServerOnlyPacket] ConnectionDenied,
    [ServerOnlyPacket] CreateEntity,
    [ServerOnlyPacket] CreateEntity2,
    StartWalk,
    PauseMove,
    ResumeMove,
    [ServerOnlyPacket] Move,
    Attack,
    [ServerOnlyPacket] TakeDamage,
    LookTowards,
    SitStand,
    [ServerOnlyPacket] RemoveEntity,
    [ServerOnlyPacket] RemoveAllEntities,
    Disconnect,
    [ServerOnlyPacket] ChangeMaps,
    StopAction,
    StopImmediate,
    RandomTeleport,
    UnhandledPacket,
    [ServerOnlyPacket] HitTarget,
    [ServerOnlyPacket] StartCast,
    [ServerOnlyPacket] StartAreaCast,
    [ServerOnlyPacket] UpdateExistingCast,
    [ServerOnlyPacket] StopCast,
    [ServerOnlyPacket] CreateCastCircle,
    Skill,
    [ServerOnlyPacket] SkillIndirect,
    [ServerOnlyPacket] SkillError,
    [ServerOnlyPacket] ErrorMessage,
    ChangeTarget,
    [ServerOnlyPacket] GainExp,
    [ServerOnlyPacket] LevelUp,
    [ServerOnlyPacket] Death,
    [ServerOnlyPacket] HpRecovery,
    [ServerOnlyPacket] ImprovedRecoveryTick,
    [ServerOnlyPacket] ChangeSpValue,
    [ServerOnlyPacket] UpdateZeny,
    Respawn,
    [ServerOnlyPacket] RequestFailed,
    [ServerOnlyPacket] Targeted,
    Say,
    ChangeName,
    [ServerOnlyPacket] Resurrection,
    UseInventoryItem,
    EquipUnequipGear,
    [ServerOnlyPacket] UpdateCharacterDisplayState,
    [ServerOnlyPacket] AddOrRemoveInventoryItem,
    [ServerOnlyPacket] EffectOnCharacter,
    [ServerOnlyPacket] EffectAtLocation,
    [ServerOnlyPacket] PlayOneShotSound,
    Emote,
    ClientTextCommand,
    UpdatePlayerData,
    ApplySkillPoint,
    ApplyStatPoints,
    ChangeTargetableState,
    UpdateMapImportantEntityTracking,
    ApplyStatusEffect,
    RemoveStatusEffect,
    SocketEquipment,

    NpcClick,
    [ServerOnlyPacket] NpcInteraction,
    NpcAdvance,
    NpcSelectOption,
    NpcRefineSubmit,

    DropItem,
    PickUpItem,
    [ServerOnlyPacket] OpenShop,
    [ServerOnlyPacket] OpenStorage,
    [ServerOnlyPacket] StartNpcTrade,
    StorageInteraction,
    ShopBuySell,
    NpcTradeItem,
    CartInventoryInteraction,
    ChangeFollower,
    [ServerOnlyPacket] ServerEvent,
    [ServerOnlyPacket] ServerResult,
    DebugEntry,

    MemoMapLocation,

    ChangePlayerSpecialActionState,
    [ServerOnlyPacket] RefreshGrantedSkills,


    SkillWithMaskedArea,

    VendingStart,
    VendingStop,
    VendingViewStore,
    VendingNotifyOfSale,
    VendingPurchaseFromStore,

    StartWalkInDirection,
    ResetMotion,

    ToggleActivatedState,

    //guild windows: one request in with an action byte, one answer out with whatever
    //that action needs. One pair rather than a dozen, since they all move the same
    //shapes and a dozen entries here is a dozen chances for the two sides to disagree.
    GuildAction,
    GuildData,

    //trading between two players: one request in with an action byte, one answer out with
    //whatever that action needs, the same shape the guild windows use
    TradeAction,
    TradeUpdate,

    //the parcel box: what an auction pays out into, since the other half of a sale is
    //usually not logged in when it happens. Same request/answer pair as the rest.
    InboxAction,
    InboxData,

    //the auction house. Listing, bidding and browsing all move through one pair.
    AuctionAction,
    AuctionData,

    //standing offers to buy: posting one, selling into one, and looking at what is
    //wanted. The other half of the market from the auction house.
    BuyOrderAction,
    BuyOrderData,

    //forging: what a crafting skill can make, and one attempt at making it. Same
    //request/answer pair the market windows use.
    CraftAction,
    CraftData,

    //who forged the weapons a player is holding. Sent alongside the items rather than
    //carried inside them - a UniqueItem is a fixed forty bytes with no room for a name.
    ForgedNames,
}

public enum MessageType : byte
{
    Local,
    MapWide,
    WorldWide,
    Server,
    Party,
    DirectMessage
}

public enum AdminAction : byte
{
    ForceGC,
    ReloadScripts,
    KillMobs,
    EnableMonsterDebugLogging,
    SignalNpc,
    ShutdownServer,
}

public enum ClientTextCommand : byte
{
    Where,
    Info,
    Adminify,
    ChatRoom,
    Guild,
    ReturnToSave,
    Zeny
}

public enum NpcInteractionType
{
    NpcFocusNpc,
    NpcDialog,
    NpcOption,
    NpcEndInteraction,
    NpcShowSprite,
    NpcOpenRefineWindow,
    NpcBeginItemTrade,
    NpcPromptForCount,
}