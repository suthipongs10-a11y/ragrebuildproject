using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.System
{
    [ClientPacketHandler(PacketType.RequestFailed)]
    public class PacketRequestFailed : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var error = (ClientErrorType)msg.ReadByte();

            switch (error)
            {
                case ClientErrorType.InvalidCoordinates:
                    Camera.AppendChatText("<color=#FF3030>ผิดพลาด</color>: พิกัดไม่ถูกต้อง");
                    break;
                case ClientErrorType.TooManyRequests:
                    Camera.AppendChatText("<color=yellow>ระวัง</color>: สั่งงานถี่เกินไป");
                    break;
                case ClientErrorType.UnknownMap:
                    Camera.AppendChatText("<color=#FF3030>ผิดพลาด</color>: ไม่พบแผนที่");
                    break;
                case ClientErrorType.MalformedRequest:
                    Camera.AppendChatText("<color=#FF3030>Error</color>: Request could not be completed due to malformed data.");
                    break;
                case ClientErrorType.RequestTooLong:
                    Camera.AppendChatText("<color=#FF3030>ผิดพลาด</color>: ข้อความยาวเกินไป");
                    break;
                case ClientErrorType.InvalidInput:
                    Camera.AppendChatText("<color=#FF3030>Error</color>: Server request could not be performed as the input was not valid.");
                    break;
            }
        }
    }
}