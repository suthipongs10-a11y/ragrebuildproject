using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.Simulation;

namespace RoRebuildServer.Networking.PacketHandlers.Social;

/// <summary>
/// Everything the friend list can be asked to do, behind one packet with an action byte.
/// </summary>
/// <remarks>
/// One pair rather than eight entries in PacketType, the same shape the guild, trade and
/// market windows use here. Eight entries is eight chances for the two sides to disagree
/// about which number means what, and they only ever disagree after a build where one of
/// them was rebuilt and the other was not.
/// </remarks>
[ClientPacketHandler(PacketType.FriendAction)]
public class PacketFriendAction : IClientPacketHandler
{
    private const int MaxWhisperLength = 140;

    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsConnectedAndInGame || connection.Player == null)
            return;

        var player = connection.Player;
        var type = (FriendRequestType)msg.ReadByte();

        switch (type)
        {
            case FriendRequestType.Refresh:
                RoDatabase.EnqueueDbRequest(new FriendListRequest(player.Id, player.Name));
                break;

            case FriendRequestType.Add:
            {
                var name = msg.ReadString();
                if (string.IsNullOrWhiteSpace(name))
                    return;

                RoDatabase.EnqueueDbRequest(new FriendAddRequest(player.Id, player.Name, name.Trim()));
                break;
            }

            case FriendRequestType.Remove:
                RoDatabase.EnqueueDbRequest(new FriendRemoveRequest(player.Id, player.Name, msg.ReadInt32()));
                break;

            case FriendRequestType.Whisper:
            {
                var target = msg.ReadString();
                var text = msg.ReadString();
                SendWhisper(player, target, text);
                break;
            }
        }
    }

    /// <summary>
    /// Hands one line to one person, and gives the sender the same line back.
    /// </summary>
    /// <remarks>
    /// Answered here rather than through the database, because a private message is only
    /// ever between two people who are both online - there is no mailbox behind it - and
    /// the world already keeps a name to player lookup. A message to somebody who is not
    /// here is refused out loud instead of being kept, which is the honest answer: nobody
    /// wants to find out an hour later that what they said went nowhere.
    /// </remarks>
    private static void SendWhisper(EntityComponents.Player player, string target, string text)
    {
        if (string.IsNullOrWhiteSpace(target) || string.IsNullOrWhiteSpace(text))
            return;

        if (text.Length > MaxWhisperLength)
            text = text.Substring(0, MaxWhisperLength);

        target = target.Trim();

        if (string.Equals(target, player.Name, StringComparison.OrdinalIgnoreCase))
        {
            CommandBuilder.SendFriendNotice(player, "คุยกับตัวเองไม่ได้");
            return;
        }

        if (!World.Instance.TryFindPlayerByName(target, out var entity)
            || !entity.TryGet<EntityComponents.Player>(out var other)
            || other.Connection == null
            || !other.Connection.IsConnectedAndInGame)
        {
            CommandBuilder.SendFriendNotice(player, $"{target} ไม่ได้ออนไลน์อยู่");
            return;
        }

        //The receiver's copy carries the sender's name, the sender's copy carries the
        //receiver's, so both windows can file the line under the person at the other end
        //without either of them having to work out which name is theirs.
        CommandBuilder.SendWhisper(other, player.Name, text, false);
        CommandBuilder.SendWhisper(player, other.Name, text, true);
    }
}
