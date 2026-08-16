using System.Collections.Generic;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// One line of the roster. Job and level are what the server last saw, which for a
    /// member who has not been online since the server started is nothing at all — hence
    /// <see cref="HasDetails"/> rather than showing them as level zero.
    /// </summary>
    public class GuildMemberInfo
    {
        public string Name = "";
        public bool IsOnline;
        public bool IsLeader;
        public int Job = -1;
        public int Level = -1;

        public bool HasDetails => Level >= 0;
    }

    /// <summary>One guild in the browse list: enough to decide whether to knock.</summary>
    public class GuildBrowseEntry
    {
        public int GuildId;
        public string Name = "";
        public int MemberCount;

        /// <summary>Whether this character has already asked to join, so the button can say so.</summary>
        public bool AlreadyAsked;
    }

    /// <summary>
    /// What this client knows about guilds, which is only ever what the server last said.
    ///
    /// Nothing here is worked out locally. Membership lives in the database and is decided
    /// by the server, so the window's job is to show this and to ask for things, and the
    /// only way anything in here changes is a GuildData packet arriving.
    ///
    /// Static because there is one player and one guild window, and it has to survive the
    /// window being closed and reopened. <see cref="Revision"/> is how the window notices:
    /// it keeps the number it last drew and rebuilds when it no longer matches. An event
    /// would mean the state holding a reference to a window that may have been destroyed,
    /// and a stale subscriber throwing inside a packet handler takes the packet with it.
    /// </summary>
    public static class GuildState
    {
        public static bool InGuild;
        public static int GuildId;
        public static string GuildName = "";
        public static bool IsLeader;

        /// <summary>Sent by the server rather than assumed, so the cap lives in one place.</summary>
        public static int MaxMembers = 40;

        public static readonly List<GuildMemberInfo> Members = new List<GuildMemberInfo>();

        /// <summary>Names waiting to be let in. Only ever filled for the leader.</summary>
        public static readonly List<string> JoinRequests = new List<string>();

        public static readonly List<GuildBrowseEntry> Browse = new List<GuildBrowseEntry>();

        /// <summary>Whether a guild list has ever come back, as against one that came back empty.</summary>
        public static bool BrowseReceived;

        /// <summary>Bumped whenever anything above changes. The window watches this.</summary>
        public static int Revision;

        public static void Touch() => Revision++;

        /// <summary>
        /// Forgets everything, for logging out or changing character.
        ///
        /// Worth having even though the server's answer to a refresh would overwrite all of
        /// it: between logging in as somebody else and that answer arriving, the window
        /// would otherwise be showing the last character's guild.
        /// </summary>
        public static void Clear()
        {
            InGuild = false;
            GuildId = 0;
            GuildName = "";
            IsLeader = false;
            Members.Clear();
            JoinRequests.Clear();
            Browse.Clear();
            BrowseReceived = false;
            Touch();
        }
    }
}
