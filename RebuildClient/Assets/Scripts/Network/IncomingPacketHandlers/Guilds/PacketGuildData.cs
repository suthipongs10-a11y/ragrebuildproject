using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Guilds
{
    /// <summary>
    /// The server's answer to anything the guild window asked for.
    ///
    /// One packet with a type byte, matching the one request packet with an action byte on
    /// the way out. The two shapes are read in the order CommandBuilder writes them and
    /// nothing here is optional, because a field read out of order does not fail — it
    /// quietly turns the rest of the packet into nonsense.
    /// </summary>
    [ClientPacketHandler(PacketType.GuildData)]
    public class PacketGuildData : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var type = (GuildDataType)msg.ReadByte();

            switch (type)
            {
                case GuildDataType.MyGuild:
                    ReadMyGuild(msg);
                    break;

                case GuildDataType.GuildList:
                    ReadGuildList(msg);
                    break;
            }

            GuildState.Touch();
        }

        private static void ReadMyGuild(ClientInboundMessage msg)
        {
            GuildState.Members.Clear();
            GuildState.JoinRequests.Clear();

            //first, and outside the has-a-guild branch, because it is about the character
            //and not about any guild
            GuildState.SetRejoinCooldown(msg.ReadInt32());

            //Sent even when there is no guild, because "you are not in one" is an answer the
            //window has to be able to receive — it is what arrives after leaving or being
            //thrown out, and without it the roster would stay on screen.
            GuildState.InGuild = msg.ReadBoolean();
            if (!GuildState.InGuild)
            {
                GuildState.GuildId = 0;
                GuildState.GuildName = "";
                GuildState.IsLeader = false;
                return;
            }

            GuildState.GuildId = msg.ReadInt32();
            GuildState.GuildName = msg.ReadString();
            GuildState.IsLeader = msg.ReadBoolean();
            GuildState.MaxMembers = msg.ReadInt32();

            var memberCount = msg.ReadInt16();
            for (var i = 0; i < memberCount; i++)
            {
                GuildState.Members.Add(new GuildMemberInfo
                {
                    Name = msg.ReadString(),
                    IsOnline = msg.ReadBoolean(),
                    IsLeader = msg.ReadBoolean(),
                    Job = msg.ReadInt16(),
                    Level = msg.ReadInt16(),
                });
            }

            //Only ever more than zero for the leader, since only the leader can answer them.
            //The count still arrives for everyone, so this is read either way.
            var requestCount = msg.ReadInt16();
            for (var i = 0; i < requestCount; i++)
                GuildState.JoinRequests.Add(msg.ReadString());
        }

        private static void ReadGuildList(ClientInboundMessage msg)
        {
            GuildState.Browse.Clear();
            GuildState.BrowseReceived = true;

            //the cap comes first here, before the count, which is the order it is written in
            GuildState.MaxMembers = msg.ReadInt32();

            var count = msg.ReadInt16();
            for (var i = 0; i < count; i++)
            {
                GuildState.Browse.Add(new GuildBrowseEntry
                {
                    GuildId = msg.ReadInt32(),
                    Name = msg.ReadString(),
                    MemberCount = msg.ReadInt16(),
                    AlreadyAsked = msg.ReadBoolean(),
                });
            }
        }
    }
}
