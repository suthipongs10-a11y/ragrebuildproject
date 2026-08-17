using Assets.Scripts.Data;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Party
{
    public static class PartyPacketHelpers
    {
        public static PartyMemberInfo LoadPartyMemberInfo(ClientInboundMessage msg)
        {
            var partyId = msg.ReadInt32();
            var entityId = msg.ReadInt32();
            var level = (int)msg.ReadInt16();
            var playerName = msg.ReadString();
            var isLeader = msg.ReadByte() == 1;
            //written for everyone, online or not, so the reader never has to guess how many
            //bytes are left before the optional part
            var kills = msg.ReadInt32();


            var partyMember = new PartyMemberInfo()
            {
                PartyMemberId = partyId,
                EntityId = entityId,
                Level = level,
                IsLeader = isLeader,
                PlayerName = playerName,
                Kills = kills
            };

            if (entityId > 0)
            {
                partyMember.Job = msg.ReadInt16();
                partyMember.Map = msg.ReadString();
                partyMember.Hp = msg.ReadInt32();
                partyMember.MaxHp = msg.ReadInt32();
                partyMember.Sp = msg.ReadInt32();
                partyMember.MaxSp = msg.ReadInt32();

                if (NetworkManager.Instance.EntityList.TryGetValue(entityId, out var controllable))
                    partyMember.Controllable = controllable;
            }

            return partyMember;
        }
    }
}