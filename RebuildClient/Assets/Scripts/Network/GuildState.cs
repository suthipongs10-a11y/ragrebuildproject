using System.Collections.Generic;
using UnityEngine;

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

    /// <summary>One guild skill as the server describes it: what it is, and how far it has
    /// been taken. The name comes from the server so the two cannot disagree about it.</summary>
    public class GuildSkillInfo
    {
        public int Id;
        public string Name = "";
        public int Level;
        public int MaxLevel;
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

        /// <summary>What the leader hung after the guild's name. Empty until one is set.</summary>
        public static string GuildTitle = "";

        /// <summary>The guild's emblem, as a number into the client's list. 0 is none.</summary>
        public static int EmblemId;

        /// <summary>What the guild has been raised to, and how it is getting there.</summary>
        public static int Level = 1;
        public static int Contribution;
        public static int ContributionToNext;
        public static int SkillPoints;

        /// <summary>How much this character may still hand over today.</summary>
        public static int DonationLeftToday;

        /// <summary>Every guild skill there is, learned or not, in the server's order.</summary>
        public static readonly List<GuildSkillInfo> Skills = new List<GuildSkillInfo>();

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

        private static int rejoinSeconds;
        private static float rejoinStamp;

        /// <summary>
        /// Records how long the server says is left, and when it said so.
        ///
        /// Kept as a deadline rather than a number to show, so the wait can be counted down
        /// on screen between packets. Asking the server every second for a figure it works
        /// out from a clock would be a packet a second for something a subtraction answers.
        /// </summary>
        public static void SetRejoinCooldown(int seconds)
        {
            rejoinSeconds = seconds > 0 ? seconds : 0;
            rejoinStamp = Time.realtimeSinceStartup;
        }

        /// <summary>
        /// What is left of the wait right now, counted down locally. Zero once it is over,
        /// which is also what anyone who never left a guild reads.
        /// </summary>
        public static int RejoinSecondsLeft
        {
            get
            {
                if (rejoinSeconds <= 0)
                    return 0;

                var left = rejoinSeconds - (int)(Time.realtimeSinceStartup - rejoinStamp);
                return left > 0 ? left : 0;
            }
        }

        /// <summary>"23 ชม. 59 นาที 12 วิ", short enough to sit on one line.</summary>
        public static string DescribeRejoinWait()
        {
            var seconds = RejoinSecondsLeft;
            var hours = seconds / 3600;
            var minutes = seconds % 3600 / 60;
            var rest = seconds % 60;

            if (hours > 0)
                return $"{hours} ชม. {minutes} นาที {rest} วิ";
            return minutes > 0 ? $"{minutes} นาที {rest} วิ" : $"{rest} วิ";
        }

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
            GuildTitle = "";
            EmblemId = 0;
            Level = 1;
            Contribution = 0;
            ContributionToNext = 0;
            SkillPoints = 0;
            DonationLeftToday = 0;
            Skills.Clear();
            IsLeader = false;
            Members.Clear();
            JoinRequests.Clear();
            Browse.Clear();
            BrowseReceived = false;
            //the wait belongs to the character that left, not to whoever logs in next
            rejoinSeconds = 0;
            Touch();
        }
    }
}
