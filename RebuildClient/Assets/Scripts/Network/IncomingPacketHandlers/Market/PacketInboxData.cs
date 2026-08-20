using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Market
{
    /// <summary>
    /// The server's answer about the parcel box.
    ///
    /// Read in the order CommandBuilder.Market writes it, field for field. Nothing here is
    /// optional and nothing may be skipped: a field read out of order does not fail, it
    /// quietly turns the rest of the packet into nonsense.
    /// </summary>
    [ClientPacketHandler(PacketType.InboxData)]
    public class PacketInboxData : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var type = (InboxDataType)msg.ReadByte();

            switch (type)
            {
                case InboxDataType.Count:
                    MarketState.ParcelsWaiting = msg.ReadInt16();
                    break;

                case InboxDataType.Contents:
                    ReadContents(msg);
                    break;
            }

            MarketState.Touch();
        }

        private static void ReadContents(ClientInboundMessage msg)
        {
            MarketState.Parcels.Clear();

            var count = msg.ReadInt16();
            for (var i = 0; i < count; i++)
            {
                var parcel = new ParcelEntry
                {
                    Id = msg.ReadInt32(),
                    Reason = (ParcelReason)msg.ReadByte(),
                    FromName = msg.ReadString(),
                    Zeny = msg.ReadInt32(),
                };

                MarketPacketReader.ReadItem(msg, parcel.Item);
                MarketState.Parcels.Add(parcel);
            }

            //The count is what the button's badge reads, and this is a fresher answer than
            //whatever last set it - so it is corrected here rather than left to drift.
            MarketState.ParcelsWaiting = MarketState.Parcels.Count;
            MarketState.ParcelsReceived = true;
        }
    }

    /// <summary>The item on a market row, read the way the server wrote it.</summary>
    public static class MarketPacketReader
    {
        public static void ReadItem(ClientInboundMessage msg, MarketItemView item)
        {
            item.ItemId = msg.ReadInt32();
            item.Count = msg.ReadInt16();
            item.IsUnique = msg.ReadBoolean();
            item.Refine = 0;
            item.Slots[0] = item.Slots[1] = item.Slots[2] = item.Slots[3] = 0;

            if (!item.IsUnique)
                return;

            item.Refine = msg.ReadByte();
            for (var i = 0; i < 4; i++)
                item.Slots[i] = msg.ReadInt32();
        }
    }
}
