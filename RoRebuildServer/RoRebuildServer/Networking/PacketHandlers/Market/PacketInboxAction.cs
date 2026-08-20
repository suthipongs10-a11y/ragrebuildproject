using System.Diagnostics;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Requests;

namespace RoRebuildServer.Networking.PacketHandlers.Market;

/// <summary>
/// The parcel box's three buttons, behind one packet with an action byte.
///
/// Nothing is decided here. Every one of these turns into a database request, because the
/// box lives in the database and the only safe place to take something out of it is the
/// one thread that reads and writes it.
/// </summary>
[ClientPacketHandler(PacketType.InboxAction)]
public class PacketInboxAction : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsConnectedAndInGame)
            return;

        Debug.Assert(connection.Player != null);

        var player = connection.Player;
        var action = (InboxRequestType)msg.ReadByte();

        //A player who has not finished loading has no bag to put anything in, and a claim
        //that arrives then would come straight back as "your bag is full".
        if (player.Inventory == null)
            return;

        switch (action)
        {
            case InboxRequestType.Refresh:
                RoDatabase.EnqueueDbRequest(new InboxLoadRequest(player.Id, player.Name));
                break;

            case InboxRequestType.Claim:
                RoDatabase.EnqueueDbRequest(new InboxClaimRequest(player.Id, player.Name, msg.ReadInt32()));
                break;

            case InboxRequestType.ClaimAll:
                RoDatabase.EnqueueDbRequest(new InboxClaimRequest(player.Id, player.Name, -1));
                break;
        }
    }
}
