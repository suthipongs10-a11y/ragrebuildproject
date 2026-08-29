using System;
using System.Collections.Generic;
using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Enum.EntityStats;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Crafting
{
    /// <summary>
    /// The options rolled onto the equipment this character can see.
    ///
    /// Arrives beside the items rather than inside them, and always before anything draws
    /// them: the server sends this straight after the inventory it belongs to.
    ///
    /// An entry with no options is a removal rather than an empty item - that is how a
    /// blank scroll reaches a client that was told about the old options a minute ago.
    ///
    /// The writing half is the server's CommandBuilder.WriteEnchant, field for field in
    /// the same order.
    /// </summary>
    [ClientPacketHandler(PacketType.EnchantedItems)]
    public class PacketEnchantedItems : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var count = msg.ReadInt16();

            for (var i = 0; i < count; i++)
            {
                var id = new Guid(msg.ReadBytes(16));
                var tier = msg.ReadByte();
                var optionCount = msg.ReadByte();

                //Read every option the packet claims even when the entry turns out to be a
                //removal, or everything after it in the message is read at the wrong offset.
                var options = new List<EnchantOptionEntry>(optionCount);

                for (var j = 0; j < optionCount; j++)
                {
                    options.Add(new EnchantOptionEntry()
                    {
                        Stat = (CharacterStat)msg.ReadInt16(),
                        Value = msg.ReadInt32()
                    });
                }

                ItemEnchants.Set(id, new ItemEnchantEntry() { Tier = tier, Options = options });
            }
        }
    }
}
