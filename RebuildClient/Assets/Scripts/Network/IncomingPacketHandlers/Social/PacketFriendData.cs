using Assets.Scripts.Data;
using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.UI;
using Assets.Scripts.UI.Party;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using Assets.Scripts.UI.Utility;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Social
{
    /// <summary>
    /// Everything the server says about the friend list, behind one packet with a type byte.
    /// </summary>
    /// <remarks>
    /// Matches what CommandBuilder.Friends writes. The whole list, one line of it, a private
    /// message, or a sentence to show the player - four shapes rather than four packets, the
    /// same arrangement the guild, trade and market windows use.
    /// </remarks>
    [ClientPacketHandler(PacketType.FriendData)]
    public class PacketFriendData : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var state = PlayerState.Instance;
            var type = (FriendDataType)msg.ReadByte();

            switch (type)
            {
                case FriendDataType.FullList:
                {
                    var count = msg.ReadInt16();
                    state.Friends.Clear();
                    for (var i = 0; i < count; i++)
                        state.Friends.Add(ReadFriend(msg));

                    state.Friends.Sort();
                    state.FriendRevision++;
                    PartyWindow.RefreshIfOpen();
                    break;
                }

                case FriendDataType.Status:
                {
                    var friend = ReadFriend(msg);
                    var existing = state.FindFriend(friend.EntryId);

                    //Replaced in place rather than added, because a status message is only
                    //ever about somebody already on the list - and a list that grows a
                    //second copy of a name every time they log in is worse than one that
                    //quietly misses an update.
                    if (existing == null)
                        break;

                    var wasOnline = existing.IsOnline;
                    existing.Name = friend.Name;
                    existing.Job = friend.Job;
                    existing.Level = friend.Level;
                    existing.GuildName = friend.GuildName;
                    existing.IsOnline = friend.IsOnline;

                    state.Friends.Sort();
                    state.FriendRevision++;
                    PartyWindow.RefreshIfOpen();

                    if (wasOnline != friend.IsOnline)
                        CameraFollower.Instance.AppendChatText(friend.IsOnline
                            ? $"<color={ChatColor.Friend}>{friend.Name} ออนไลน์แล้ว</color>"
                            : $"<color={ChatColor.Friend}>{friend.Name} ออฟไลน์แล้ว</color>");

                    break;
                }

                case FriendDataType.Whisper:
                {
                    var otherName = msg.ReadString();
                    var text = msg.ReadString();
                    var isOutgoing = msg.ReadBoolean();
                    WhisperWindow.Deliver(otherName, text, isOutgoing);
                    break;
                }

                case FriendDataType.Notice:
                    CameraFollower.Instance.AppendChatText($"<color={ChatColor.Friend}>{msg.ReadString()}</color>");
                    break;
            }
        }

        private static FriendInfo ReadFriend(ClientInboundMessage msg)
        {
            return new FriendInfo
            {
                EntryId = msg.ReadInt32(),
                Name = msg.ReadString(),
                Job = msg.ReadInt16(),
                Level = msg.ReadInt16(),
                GuildName = msg.ReadString(),
                IsOnline = msg.ReadBoolean(),
            };
        }
    }
}
