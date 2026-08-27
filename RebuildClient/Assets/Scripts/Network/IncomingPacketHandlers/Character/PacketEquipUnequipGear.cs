using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using Assets.Scripts.UI.Utility;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Character
{
    [ClientPacketHandler(PacketType.EquipUnequipGear)]
    public class PacketEquipUnequipGear : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var bagId = msg.ReadInt32();
            var slot = (EquipSlot)msg.ReadByte();
            var isEquip = msg.ReadBoolean();

            var item = State.Inventory.GetInventoryItem(bagId);
            if (item.ItemData.ItemClass == ItemClass.Ammo)
            {
                if (isEquip)
                {
                    Camera.AppendChatText($"{ChatColor.Equipment}ใส่ {item.ProperName()} แล้ว</color>");
                    State.AmmoId = bagId;
                }
                else
                {
                    Camera.AppendChatText($"{ChatColor.Removed}ถอด {item.ProperName()} แล้ว</color>");
                    State.AmmoId = -1;
                }
                UiManager.Instance.InventoryWindow.UpdateActiveVisibleBag();
            }
            else
            {
                if (isEquip)
                    Camera.AppendChatText($"{ChatColor.Equipment}สวม {item.ProperName()} แล้ว</color>");
                else
                    Camera.AppendChatText($"{ChatColor.Removed}ถอด {item.ProperName()} แล้ว</color>");
            }
            
            if (slot == EquipSlot.Ammunition)
            {
                if (isEquip)
                    State.AmmoId = bagId;
                else
                    State.AmmoId = 0;
            }
            else
            {
                State.EquippedBagIdHashes.Remove(State.EquippedItems[(int)slot]); //if the slot is empty it's fine, remove just won't take anything out

                if (isEquip)
                {
                    State.EquippedItems[(int)slot] = bagId;
                    State.EquippedBagIdHashes.Add(bagId);
                }
                else
                    State.EquippedItems[(int)slot] = 0;
            }
            
            UiManager.EquipmentWindow.RefreshEquipmentWindow();
        }
    }
}