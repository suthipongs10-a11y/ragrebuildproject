using System.Collections.Generic;
using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Market
{
    /// <summary>
    /// The server's answer about standing offers to buy.
    ///
    /// One shape for both the board and this character's own orders, matching what
    /// CommandBuilder.Market writes: the page and the total go out either way.
    /// </summary>
    [ClientPacketHandler(PacketType.BuyOrderData)]
    public class PacketBuyOrderData : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var type = (BuyOrderDataType)msg.ReadByte();
            var page = msg.ReadByte();
            var total = msg.ReadInt32();

            var into = type == BuyOrderDataType.MyOrders
                ? MarketState.MyBuyOrders
                : MarketState.BuyOrders;

            into.Clear();

            var count = msg.ReadInt16();
            for (var i = 0; i < count; i++)
            {
                into.Add(new BuyOrderEntry
                {
                    Id = msg.ReadInt32(),
                    BuyerName = msg.ReadString(),
                    ItemId = msg.ReadInt32(),
                    WantedCount = msg.ReadInt32(),
                    RemainingCount = msg.ReadInt32(),
                    PricePer = msg.ReadInt32(),
                    SecondsLeft = msg.ReadInt32(),
                });
            }

            if (type == BuyOrderDataType.MyOrders)
                MarketState.MyBuyOrdersReceived = true;
            else
            {
                MarketState.BuyPage = page;
                MarketState.BuyTotal = total;
                MarketState.BuyOrdersReceived = true;
            }

            MarketState.Touch();
        }
    }
}
