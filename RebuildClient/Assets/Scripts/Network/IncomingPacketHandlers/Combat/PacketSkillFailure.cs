using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.UI.Inventory;
using Assets.Scripts.UI.Utility;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using UnityEngine;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Combat
{
    [ClientPacketHandler(PacketType.SkillError)]
    public class PacketSkillFailure : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var result = (SkillValidationResult)msg.ReadByte();

            switch (result)
            {
                case SkillValidationResult.IncorrectAmmunition:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ใส่กระสุนผิดชนิด</color>");
                    break;
                case SkillValidationResult.IncorrectWeapon:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ใช้กับอาวุธชนิดนี้ไม่ได้</color>");
                    break;
                case SkillValidationResult.InsufficientSp:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: SP ไม่พอ</color>");
                    break;
                case SkillValidationResult.InsufficientZeny:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: เงินไม่พอ</color>");
                    break;
                case SkillValidationResult.InsufficientItemCount:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ไม่มีไอเทมที่ต้องใช้</color>");
                    break;
                case SkillValidationResult.CannotTargetBossMonster:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: มอนสเตอร์ตัวนี้ไม่ติดผลของสกิล</color>");
                    break;
                case SkillValidationResult.ItemAlreadyStolen:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ขโมยจากตัวนี้ไปแล้ว</color>");
                    break;
                case SkillValidationResult.Failure:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ</color>");
                    break;
                case SkillValidationResult.MemoLocationInvalid:
                    Camera.AppendChatText($"{ChatColor.Error}จุดนี้ใช้เป็นปลายทาง Warp Portal ไม่ได้</color>");
                    break;
                case SkillValidationResult.MemoLocationUnwalkable:
                    Camera.AppendChatText($"{ChatColor.Error}จำจุดนี้ไม่ได้ เพราะยืนอยู่บนพื้นที่เดินไม่ได้</color>");
                    break;
                case SkillValidationResult.MustBeStandingInWater:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ต้องมีน้ำอยู่ใกล้ ๆ</color>");
                    break;
                case SkillValidationResult.MissingRequiredItem:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ไม่มีไอเทมหรือตัวประกอบที่ต้องใช้</color>");
                    break;
                case SkillValidationResult.SkillNotKnown:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ยังไม่ได้เรียนสกิลนี้</color>");
                    break;
                case SkillValidationResult.TrapTooClose:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ใกล้กับดัก ผู้เล่น หรือมอนสเตอร์อื่นเกินไป</color>");
                    break;
                case SkillValidationResult.TargetImmuneToEffect:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: อุปกรณ์ของเป้าหมายกันสกิลนี้</color>");
                    break;
                case SkillValidationResult.TargetAreaOccupied:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: พื้นที่ตรงนั้นถูกใช้อยู่</color>");
                    break;
                case SkillValidationResult.CannotTargetSelf:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ใช้ใส่ตัวเองไม่ได้</color>");
                    break;
                case SkillValidationResult.TargetStateIgnoresEffect:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: เป้าหมายติดสถานะที่กันสกิลนี้อยู่</color>");
                    break;
                case SkillValidationResult.UnusableWhileHidden:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ใช้ตอนซ่อนตัวไม่ได้</color>");
                    break;
                case SkillValidationResult.MustBeUsedWhileHidden:
                    Camera.AppendChatText($"{ChatColor.Error}ใช้สกิลไม่สำเร็จ: ใช้ได้เฉพาะตอนซ่อนตัว</color>");
                    break;
                case SkillValidationResult.CannotTeleportHere:
                    Camera.AppendChatText($"{ChatColor.Error}วาร์ปในจุดนี้ไม่ได้</color>");
                    break;
                case SkillValidationResult.VendFailedGenericError:
                    VendingSetupManager.Instance?.ResumeVendWindow();
                    Camera.AppendChatText("เปิดร้านไม่สำเร็จ", TextColor.Error);
                    break;
                case SkillValidationResult.VendFailedInvalidPrice:
                    VendingSetupManager.Instance?.ResumeVendWindow();
                    Camera.AppendChatText("เปิดร้านไม่สำเร็จ: ตั้งราคาไม่ถูกต้อง (สูงสุด 9,999,999z)", TextColor.Error);
                    break;
                case SkillValidationResult.VendFailedItemsNotPreset:
                    VendingSetupManager.Instance?.ResumeVendWindow();
                    Camera.AppendChatText("เปิดร้านไม่สำเร็จ: มีของบางชิ้นไม่อยู่ในรถเข็นแล้ว", TextColor.Error);
                    break;
                case SkillValidationResult.VendFailedNameNotValid:
                    VendingSetupManager.Instance?.ResumeVendWindow();
                    Camera.AppendChatText("เปิดร้านไม่สำเร็จ: ชื่อร้านใช้ไม่ได้", TextColor.Error);
                    break;
                case SkillValidationResult.VendFailedTooCloseToNpc:
                    VendingSetupManager.Instance?.ResumeVendWindow();
                    Camera.AppendChatText("เปิดร้านไม่สำเร็จ: ต้องห่างจาก NPC อย่างน้อย 4 ช่อง", TextColor.Error);
                    break;
                case SkillValidationResult.VendFailedTooManyItems:
                    VendingSetupManager.Instance?.ResumeVendWindow();
                    Camera.AppendChatText("เปิดร้านไม่สำเร็จ: วางของเกินจำนวนที่เลเวล Vending ของคุณวางได้", TextColor.Error);
                    break;
                default:
                    Debug.Log($"Skill failure (not shown to user): {result}");
                    break;
            }
        }
    }
}