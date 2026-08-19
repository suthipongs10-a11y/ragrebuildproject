using System.Collections.Generic;
using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.UI.Inventory;
using Assets.Scripts.UI.Utility;
using RebuildSharedData.Data;
using RebuildSharedData.Networking;
using UnityEngine;

namespace Assets.Scripts.Network.IncomingPacketHandlers
{
    [ClientPacketHandler(PacketType.VendingStart)]
    public class PacketStartVending : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var name = msg.ReadString();
            var entryCount = msg.ReadInt32();

            var list = new Dictionary<int, InventoryItem>(entryCount);
            var prices = new Dictionary<int, int>(entryCount);
            var cart = PlayerState.Instance.Cart;

            CameraFollower.Instance.AppendChatText($"เปิดร้านชื่อ {name} แล้ว", TextColor.Job);

            for (var i = 0; i < entryCount; i++)
            {
                var bagId = msg.ReadInt32();
                var count = msg.ReadInt32();
                var price = msg.ReadInt32();

                if (!cart.TryGetInventoryItem(bagId, out var item))
                {
                    Debug.LogWarning($"Could not get cart item with a bagId of {bagId}");
                    item = new InventoryItem(new RegularItem() { Id = 512, Count = (short)count });
                    
                    
                }
                item.Count = count;
                if(item.Count > 1)
                    CameraFollower.Instance.AppendChatText($"ตั้งขาย {item.ProperName()} x{count} ราคา {price:N0}z", TextColor.Job);
                else
                    CameraFollower.Instance.AppendChatText($"ตั้งขาย {item.ProperName()} ราคา {price:N0}z", TextColor.Job);
                
                list.Add(bagId, item);
                prices.Add(bagId, price);
            }
            
            VendingActiveWindow.BeginActiveVending(name, list, prices);
        }
    }
}