using System;

namespace Assets.Scripts.Data
{
    /// <summary>
    /// One name on the friend list, as the server last described it.
    /// </summary>
    /// <remarks>
    /// Everything here except the entry id is a snapshot. A friend who is offline is
    /// described from the character as it was last saved, so the level is the level they
    /// logged out at rather than the level they are now - which is the honest thing to
    /// show, and is what the window says by drawing an offline row in a quieter ink.
    /// </remarks>
    [Serializable]
    public class FriendInfo : IComparable
    {
        /// <summary>The database row, which is what removing one points at.</summary>
        public int EntryId;

        public string Name;

        /// <summary>The job id, or -1 for somebody the server has not seen since it started.</summary>
        public int Job = -1;

        public int Level;
        public string GuildName;
        public bool IsOnline;

        /// <summary>Online first, then by name. Which is the order anybody reads this list in.</summary>
        public int CompareTo(object obj)
        {
            if (obj is not FriendInfo other)
                return 0;

            if (IsOnline != other.IsOnline)
                return IsOnline ? -1 : 1;

            return string.Compare(Name, other.Name, StringComparison.OrdinalIgnoreCase);
        }
    }
}
