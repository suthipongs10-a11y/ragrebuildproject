using System.Collections.Generic;
using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Market
{
    /// <summary>
    /// The server's answer about the auction board.
    ///
    /// Same shape as the parcel box's: one packet with a type byte, read in the order
    /// CommandBuilder.Market writes it.
    /// </summary>
    [ClientPacketHandler(PacketType.AuctionData)]
    public class PacketAuctionData : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var type = (AuctionDataType)msg.ReadByte();

            switch (type)
            {
                case AuctionDataType.Listings:
                {
                    MarketState.BrowsePage = msg.ReadByte();
                    MarketState.BrowseTotal = msg.ReadInt32();
                    ReadInto(msg, MarketState.Listings);
                    MarketState.ListingsReceived = true;
                    break;
                }

                case AuctionDataType.MyListings:
                    ReadInto(msg, MarketState.Mine);
                    MarketState.MineReceived = true;
                    break;
            }

            MarketState.Touch();
        }

        private static void ReadInto(ClientInboundMessage msg, List<AuctionEntry> into)
        {
            into.Clear();

            var count = msg.ReadInt16();
            for (var i = 0; i < count; i++)
            {
                var entry = new AuctionEntry
                {
                    Id = msg.ReadInt32(),
                    IsMine = msg.ReadBoolean(),
                    SellerName = msg.ReadString(),
                };

                MarketPacketReader.ReadItem(msg, entry.Item);

                entry.StartPrice = msg.ReadInt32();
                entry.HighBid = msg.ReadInt32();
                entry.HighBidderName = msg.ReadString();
                entry.SecondsLeft = msg.ReadInt32();

                into.Add(entry);
            }
        }
    }
}
