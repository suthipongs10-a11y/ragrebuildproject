using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.UI.Hud;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using Assets.Scripts.UI.Utility;

namespace Assets.Scripts.Network.IncomingPacketHandlers.System
{
    [ClientPacketHandler(PacketType.ServerEvent)]
    public class PacketServerEvent : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var type = (ServerEvent)msg.ReadByte();
            var val = msg.ReadInt32();
            // var text = msg.ReadString();

            switch (type)
            {
                case ServerEvent.TradeSuccess:
                    Camera.AppendChatText($"{ChatColor.Party}แลกเปลี่ยนสำเร็จ</color>");
                    break;
                case ServerEvent.GetZeny:
                    if (val > 0)
                        Camera.AppendChatText($"{ChatColor.Item}ได้รับ {val} เซนี่</color>");
                    if (val < 0)
                        Camera.AppendChatText($"{ChatColor.Removed}เสียไป {-val} เซนี่</color>");
                    break;
                case ServerEvent.NoAmmoEquipped:
                    if (Camera.TargetControllable.WeaponClass == 12)
                        Camera.AppendChatText($"{ChatColor.Error}ยังไม่ได้ใส่ลูกธนู</color>");
                    else
                        Camera.AppendChatText($"{ChatColor.Error}ยังไม่ได้ใส่กระสุน</color>");
                    break;
                case ServerEvent.WrongAmmoEquipped:
                    Camera.AppendChatText($"{ChatColor.Error}ใส่กระสุนผิดชนิด</color>");
                    break;
                case ServerEvent.OutOfAmmo:
                    Camera.AppendChatText($"{ChatColor.Error}กระสุนไม่พอยิงแล้ว</color>");
                    break;
                case ServerEvent.EligibleForJobChange:
                    Camera.AppendChatText($"{ChatColor.Job}<i>Congratulations, you've reached job 10! You are now eligible to change jobs. "
                                          + "Speak to the bard south of Prontera to get started.</i></color>");
                    break;
                case ServerEvent.Announcement:
                    //the chat copy is sent separately so the line is still there to read
                    //once the banner has gone, all this has to do is put it on screen
                    AnnouncementBanner.Show(msg.ReadString());
                    break;
                case ServerEvent.CardBonus:
                {
                    //A card's find lands on the ground and picking it up says so, but the
                    //pickup line looks exactly like every other pickup, so there was nothing
                    //to tell the player their card had done anything at all.
                    var found = msg.ReadString();
                    if (string.IsNullOrEmpty(found))
                        Camera.AppendChatText($"{ChatColor.Item}[การ์ด] ได้รับ {val} เซนี่</color>");
                    else if (val > 1)
                        Camera.AppendChatText($"{ChatColor.Item}[การ์ด] พบ {val}x {found}</color>");
                    else
                        Camera.AppendChatText($"{ChatColor.Item}[การ์ด] พบ {found}</color>");
                    break;
                }
                case ServerEvent.OreDiscovery:
                {
                    //Same reasoning as the card line above: the ore lands on the ground
                    //looking like any other drop, and at these odds a blacksmith who is not
                    //told would never know the skill had fired.
                    var ore = msg.ReadString();
                    Camera.AppendChatText($"{ChatColor.Item}[แร่] เจอ {ore}</color>");
                    break;
                }
                case ServerEvent.MemoLocationSaved:
                    if(State.KnownSkills.TryGetValue(CharacterSkill.WarpPortal, out var level) && level > 1)
                        Camera.AppendChatText($"{ChatColor.Skill}จำจุดนี้เป็นปลายทาง Warp Portal ช่องที่ {val + 1} แล้ว</color>");
                    else
                        Camera.AppendChatText($"{ChatColor.Skill}จำจุดนี้เป็นปลายทาง Warp Portal แล้ว</color>");
                    break;
                // case ServerEvent.PartyInviteSent:
                //     Camera.AppendChatText($"<color=#77FF77>ส่งคำชวนเข้าปาร์ตี้แล้ว</color>");
                //     break;
            }
        }
    }
}