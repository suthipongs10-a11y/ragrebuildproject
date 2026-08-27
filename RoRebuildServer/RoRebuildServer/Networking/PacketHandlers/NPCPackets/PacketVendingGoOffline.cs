using RebuildSharedData.Networking;
using RoRebuildServer.Simulation;

namespace RoRebuildServer.Networking.PacketHandlers.NPCPackets;

/// <summary>
/// "Leave my shop open and log me out."
/// </summary>
/// <remarks>
/// This does not close the socket and it does not move the character. The character stays
/// exactly where it is standing and the shop stays exactly as it was; DisconnectPlayer
/// reads the connection's flag on the way past and leaves the character behind rather
/// than taking it out of the world.
///
/// Nothing here decides the character's fate, and that is deliberate: taking a character
/// out of the world is a main thread job, and this handler runs on the map thread. All of
/// that happens in OfflineVending, driven from the world's own update.
/// </remarks>
[ClientPacketHandler(PacketType.VendingGoOffline)]
public class PacketVendingGoOffline : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        //Already raised, by the dispatcher, before this packet was queued - see the note
        //there. So this method's job is the opposite one: to put it back down for anybody
        //who asked for a shop they are not actually running.
        var player = connection.Player;

        if (!connection.IsConnectedAndInGame || player == null)
        {
            connection.IsOfflineVending = false;
            return;
        }

        if (!OfflineVending.IsEnabled)
        {
            connection.IsOfflineVending = false;
            CommandBuilder.ErrorMessage(player, "เซิร์ฟเวอร์ปิดระบบร้านค้า Offline อยู่");
            return;
        }

        if (!OfflineVending.IsVending(player))
        {
            connection.IsOfflineVending = false;
            CommandBuilder.ErrorMessage(player, "ต้องเปิดร้านค้าอยู่ก่อนถึงจะตั้งเป็นร้าน Offline ได้");
            return;
        }

        //Nothing is said back on success. The socket is on its way out and a message racing
        //a close is a message that may or may not arrive; the client says its own piece
        //before it ever sends this, which always arrives because it never left.
        //Asked for here as well as by the client, so a client that sends this and then sits
        //there still ends up logged out rather than standing in its own shop.
        NetworkManager.QueueDisconnect(connection);
    }
}
