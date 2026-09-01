using System;
using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Crafting
{
    /// <summary>
    /// The names of the smiths who made the weapons in the bag.
    ///
    /// Arrives beside the items rather than inside them, and always before anything draws
    /// them: the server sends this straight after the inventory it belongs to.
    /// </summary>
    [ClientPacketHandler(PacketType.ForgedNames)]
    public class PacketForgedNames : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var count = msg.ReadInt16();

            for (var i = 0; i < count; i++)
            {
                var id = new Guid(msg.ReadBytes(16));
                var forger = msg.ReadString();

                ForgedNames.Set(id, forger, msg.ReadByte());
            }
        }
    }
}
