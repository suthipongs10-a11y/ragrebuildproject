using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.UI.Utility;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.System
{
    [ClientPacketHandler(PacketType.ServerResult)]
    public class PacketServerResult : ClientPacketHandlerBase
    {   
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var type = (ServerResult)msg.ReadByte();
            var val = msg.ReadInt32();
            // var text = msg.ReadString();

            switch (type)
            {
                case ServerResult.PartyInviteSent:
                    Camera.AppendChatText($"ส่งคำชวนเข้าปาร์ตี้แล้ว", TextColor.Party);
                    break;
                case ServerResult.InviteFailedAlreadyInParty:
                    Camera.AppendChatText($"ชวนไม่สำเร็จ เขาอยู่ปาร์ตี้อื่นแล้ว", TextColor.Error);
                    break;
                case ServerResult.InviteFailedRecipientNoBasicSkill:
                    Camera.AppendChatText($"ชวนไม่สำเร็จ Basic Skill ของเขายังไม่ถึง", TextColor.Error);
                    break;
                case ServerResult.InviteFailedSenderNoBasicSkill:
                    Camera.AppendChatText($"Basic Skill ของคุณยังไม่ถึงเลเวลที่เข้าปาร์ตี้ได้", TextColor.Error);
                    break;
            }
        }
    }
}