using RebuildSharedData.Enum;
//OutboundMessage lives in RebuildZoneServer.Networking, not in the namespace its folder
//is named after - see tools/check/nsresolve.py, which is here because of this exact type
using RebuildZoneServer.Networking;
using RebuildSharedData.Networking;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.EntityComponents;

namespace RoRebuildServer.Networking;

public static partial class CommandBuilder
{
    /// <summary>
    /// The whole list: everyone remembered, with what they are doing now.
    /// </summary>
    /// <remarks>
    /// Sent whole rather than a page at a time. A packet has about eight thousand bytes to
    /// work with and a friend is roughly sixty of them once the name and the guild are in,
    /// so sixty friends is a fifth of that - see FriendQueries.MaxFriends, which is what
    /// keeps that true.
    /// </remarks>
    public static void SendFriendList(Player player, List<FriendView> friends)
    {
        var packet = NetworkManager.StartPacket(PacketType.FriendData, 4096);
        packet.Write((byte)FriendDataType.FullList);
        packet.Write((short)friends.Count);

        for (var i = 0; i < friends.Count; i++)
            WriteFriend(packet, friends[i]);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>One line of the list changed, usually because somebody arrived or left.</summary>
    public static void SendFriendStatus(Player player, FriendView friend)
    {
        var packet = NetworkManager.StartPacket(PacketType.FriendData, 256);
        packet.Write((byte)FriendDataType.Status);
        WriteFriend(packet, friend);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>
    /// A private message, to whoever is at either end of it.
    /// </summary>
    /// <param name="isOutgoing">
    /// Whether this is the copy shown to the sender. Both ends get one so that a
    /// conversation reads the same on both screens, and the flag is what tells a window
    /// which side of it to put the line on.
    /// </param>
    public static void SendWhisper(Player player, string otherName, string message, bool isOutgoing)
    {
        var packet = NetworkManager.StartPacket(PacketType.FriendData, 512);
        packet.Write((byte)FriendDataType.Whisper);
        packet.Write(otherName);
        packet.Write(message);
        packet.Write(isOutgoing);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>Something to say to the player about their list, in words they can read.</summary>
    public static void SendFriendNotice(Player player, string text)
    {
        var packet = NetworkManager.StartPacket(PacketType.FriendData, 256);
        packet.Write((byte)FriendDataType.Notice);
        packet.Write(text);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    private static void WriteFriend(OutboundMessage packet, FriendView friend)
    {
        packet.Write(friend.EntryId);
        packet.Write(friend.Name ?? string.Empty);
        //A job of -1 means nobody has ever seen this character since the server came up,
        //which the window says as "offline" rather than drawing them as a level nothing
        //novice - the same choice the party window already makes.
        packet.Write((short)friend.Job);
        packet.Write((short)friend.Level);
        packet.Write(friend.GuildName ?? string.Empty);
        packet.Write(friend.IsOnline);
    }
}
