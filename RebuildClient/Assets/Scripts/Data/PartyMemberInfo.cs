using System;
using Assets.Scripts.Network;

namespace Assets.Scripts.Data
{
    public class PartyMemberInfo : IComparable
    {
        public int PartyMemberId;
        public int EntityId;
        public int Level;
        public string Map;
        public string PlayerName;
        public bool IsLeader;
        public ServerControllable Controllable;
        public int Hp;
        public int MaxHp;
        public int Sp;
        public int MaxSp;

        /// <summary>
        /// The job id, or -1 for a member the server has not seen since it started. Offline
        /// members are a name and nothing else, so the window says offline rather than
        /// showing them as a level zero novice.
        /// </summary>
        public int Job = -1;

        /// <summary>Monsters this member has finished off since the party was formed.</summary>
        public int Kills;

        public bool HasDetails => EntityId > 0 && Job >= 0;

        //comparer sorts by online status, then by name
        public int CompareTo(object obj)
        {
            if (obj is not PartyMemberInfo other)
                return 0;

            if (EntityId > 0 && other.EntityId > 0)
                return String.Compare(PlayerName, other.PlayerName, StringComparison.Ordinal);

            if (EntityId > 0)
                return -1;

            if (other.EntityId > 0)
                return 1;

            return String.Compare(PlayerName, other.PlayerName, StringComparison.Ordinal);
        }
    }
}