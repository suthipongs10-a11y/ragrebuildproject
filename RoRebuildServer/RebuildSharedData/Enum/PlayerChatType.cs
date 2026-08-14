namespace RebuildSharedData.Enum;

public enum PlayerChatType
{
    Say,
    Shout,
    Party,
    Notice,
    ChatRoom //server side only, clients ask for rooms via ClientTextCommand and Say
}