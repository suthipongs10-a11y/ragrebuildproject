namespace Assets.Scripts.UI.Utility
{
    public enum TextColor
    {
        Normal,
        Party,
        Skill,
        Job,
        Equipment,
        Item,
        Error,
        System,
        //Appended rather than slotted in among the ones above, so that nothing which
        //happens to have been written down as a number keeps meaning what it used to.
        Guild,
        Friend,
        Removed
    }

    /// <summary>
    /// The colours the chat log writes in.
    /// </summary>
    /// <remarks>
    /// One place, because there is no other way to keep a palette a palette. These used to
    /// be written as hex at each of the ninety odd places something is said, and the result
    /// was what you would expect: a dozen shades of nearly the same blue, two different
    /// greens for the same kind of event, and one navy so dark that on the log's own panel
    /// it cleared 2.2 to 1 - which is to say the friend list could not be read at all.
    ///
    /// Every one of these is bright and saturated on purpose. The log is read at a glance
    /// over its own dark panel and over whatever the player is standing on, and a colour
    /// that is merely dark loses on both.
    ///
    /// The notices below are also held apart from each other by hand - see
    /// tools/check/chatcolors.py, which fails if any two of them come within sixty of each
    /// other in rgb. What makes a busy log readable is telling two lines apart without
    /// having to read either of them, and a palette drifts towards one colour on its own
    /// if nothing is watching: everything wants to be gold.
    /// </remarks>
    public static class ChatColor
    {
        //people
        public const string Party = "#5CFF9E";      //spring green - party events and invites
        public const string Guild = "#C09BFF";      //violet - guild events, kept off the party green
        public const string Friend = "#FF7ACD";     //pink - the friend list, which used to be unreadable

        //things
        public const string Item = "#FFC22E";       //gold - items, zeny, cards and ore arriving
        public const string Equipment = "#4DD8FF";  //cyan - putting something on
        public const string Removed = "#D8C49A";    //faded gold - the item colour, going away

        //the character and the world
        public const string Skill = "#7CFF4D";      //lime - skills, warp memos
        public const string Job = "#FF7A1A";        //orange - job changes, shops, milestones
        public const string Error = "#FF6A6A";      //red - something did not work
        public const string System = "#FFF75C";     //yellow - the server talking

        /// <summary>
        /// What people say, as opposed to what the game says.
        /// </summary>
        /// <remarks>
        /// Kept apart from the notices above, and exempt from the rule that holds those
        /// apart from each other. A line of speech always arrives with somebody's name in
        /// front of it, so it is never mistaken for a notice - these four only ever have to
        /// be told apart from each other.
        /// </remarks>
        public static class Speech
        {
            public const string Say = "#FFF07A";    //somebody talking nearby
            public const string Shout = "#FFB24D";  //shouting
            public const string Party = "#7BFF7B";  //a party member
            public const string Room = "#8FDCFF";   //a chat room
            public const string Guild = "#D9B8FF";  //a guild member, lighter than the guild notice violet
        }

        /// <summary>Opens a coloured run. Pair it with <see cref="End"/>.</summary>
        public static string Open(string colour) => "<color=" + colour + ">";

        public const string End = "</color>";

        /// <summary>One line in one colour, which is what almost every caller wants.</summary>
        public static string Wrap(string colour, string text) => "<color=" + colour + ">" + text + End;
    }
}
