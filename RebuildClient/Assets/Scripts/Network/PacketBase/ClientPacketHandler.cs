using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.Network.IncomingPacketHandlers;
using Assets.Scripts.PlayerControl;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.PacketBase
{
    public static partial class ClientPacketHandler
    {
        private static readonly ClientPacketHandlerBase[] handlers;

        /// <summary>
        /// Whether this packet has somewhere to go.
        ///
        /// Less than the length, not less than or equal: the guard is the only thing
        /// standing between a packet number the table does not reach and an index off the
        /// end of it, and off by one here throws inside the receive loop rather than
        /// ignoring one packet. The table is shorter than the enum whenever a handler has
        /// been added and the generator has not been run, which is exactly when this
        /// matters.
        /// </summary>
        public static bool HasValidHandler(PacketType type) =>
            (int)type >= 0 && (int)type < handlers.Length
            && handlers[(int)type].GetType() != typeof(InvalidPacket);

        public static void Execute(PacketType type, ClientInboundMessage msg) => handlers[(int)type].ReceivePacket(msg);
        
        public static void Init(NetworkManager network, PlayerState state)
        {
            //Said out loud once at startup, because the table is generated from inside the
            //editor and nothing runs that automatically. A client whose scripts have not
            //been recompiled since a handler was added has an older, shorter table, and
            //the only symptom is a packet arriving and going nowhere - which reads as the
            //server never answering. This line is the difference between the two.
            var known = System.Enum.GetNames(typeof(PacketType)).Length;
            if (handlers.Length != known)
                UnityEngine.Debug.LogError($"[Packets] the handler table holds {handlers.Length} "
                    + $"slots but this client knows {known} packet types. Run Ragnarok > CodeGen > "
                    + "Update Packet Handlers, or refresh the project if it was just pulled.");
            else
                UnityEngine.Debug.Log($"[Packets] handler table ready: {handlers.Length} slots.");

            for (var i = 0; i < handlers.Length; i++)
            {
                handlers[i].Network = network;
                handlers[i].Camera = CameraFollower.Instance;
                handlers[i].UiManager = UiManager.Instance;
                handlers[i].State = state;
            }
        }
    }
}