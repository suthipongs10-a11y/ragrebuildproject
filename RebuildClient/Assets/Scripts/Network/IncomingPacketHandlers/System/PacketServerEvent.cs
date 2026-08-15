using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.UI.Hud;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;

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
                    Camera.AppendChatText($"<color=#00fbfb>The trade completed successfully.</color>");
                    break;
                case ServerEvent.GetZeny:
                    if (val > 0)
                        Camera.AppendChatText($"<color=#00fbfb>Obtained {val} zeny.</color>");
                    if (val < 0)
                        Camera.AppendChatText($"<color=#00fbfb>Lost {-val} zeny.</color>");
                    break;
                case ServerEvent.NoAmmoEquipped:
                    if (Camera.TargetControllable.WeaponClass == 12)
                        Camera.AppendChatText($"<color=#ed0000>You don't have any arrows equipped.</color>");
                    else
                        Camera.AppendChatText($"<color=#ed0000>You don't have any ammunition equipped.</color>");
                    break;
                case ServerEvent.WrongAmmoEquipped:
                    Camera.AppendChatText($"<color=#ed0000>You don't have the right kind of ammunition equipped.</color>");
                    break;
                case ServerEvent.OutOfAmmo:
                    Camera.AppendChatText($"<color=#ed0000>You don't have enough ammunition left to fire.</color>");
                    break;
                case ServerEvent.EligibleForJobChange:
                    Camera.AppendChatText($"<color=#99CCFF><i>Congratulations, you've reached job 10! You are now eligible to change jobs. "
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
                        Camera.AppendChatText($"<color=#e0a020>[การ์ด] ได้รับ {val} เซนี่</color>");
                    else if (val > 1)
                        Camera.AppendChatText($"<color=#e0a020>[การ์ด] พบ {val}x {found}</color>");
                    else
                        Camera.AppendChatText($"<color=#e0a020>[การ์ด] พบ {found}</color>");
                    break;
                }
                case ServerEvent.MemoLocationSaved:
                    if(State.KnownSkills.TryGetValue(CharacterSkill.WarpPortal, out var level) && level > 1)
                        Camera.AppendChatText($"<color=#00fbfb>Current location has been recorded in slot {val + 1} as a warp portal destination.</color>");
                    else
                        Camera.AppendChatText($"<color=#00fbfb>Current location has been recorded as your warp portal destination.</color>");
                    break;
                // case ServerEvent.PartyInviteSent:
                //     Camera.AppendChatText($"<color=#77FF77>A party invite has been sent.</color>");
                //     break;
            }
        }
    }
}