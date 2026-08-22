using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Networking;
using UnityEngine;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Environment
{
    [ClientPacketHandler(PacketType.DropItem)]
    public class PacketDropItem : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var groundId = msg.ReadInt32();
            var pos = new Vector2(msg.ReadFloat(), msg.ReadFloat());

            //A unique item comes down whole now rather than as a bare id and count, so what
            //is on the floor can be named properly - refine, cards, element, and the smith
            //who forged it.
            var isUnique = msg.ReadBoolean();

            var id = 0;
            var count = 0;
            var unique = default(RebuildSharedData.Data.UniqueItem);

            if (isUnique)
            {
                unique = RebuildSharedData.Data.UniqueItem.Deserialize(msg);
                id = unique.Id;
                count = unique.Count;
            }
            else
            {
                id = msg.ReadInt32();
                count = msg.ReadInt16();
            }

            //how unlikely the drop was, which only the server knows; the client turns it
            //into a light around the item
            var rarity = msg.ReadByte();
            //what died to leave it there, which decides the colour of the light
            var fromBoss = msg.ReadBoolean();
            var isAnimated = msg.ReadBoolean();
            if (Network.GroundItemList.ContainsKey(groundId))
            {
                Debug.LogWarning($"Trying to create DropItem of type ${id} at location {pos}, but that drop already exists in the scene!");
                return;
            }
            var item = GroundItem.Create(groundId, id, count, pos, isAnimated, rarity, fromBoss,
                isUnique, unique);
            Network.GroundItemList.Add(groundId, item);
            
        }
    }
}