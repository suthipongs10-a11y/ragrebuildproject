using System.Collections.Generic;
using Assets.Scripts.UI.ConfigWindow;

namespace Assets.Scripts.UI.TitleScreen
{
    /// <summary>
    /// The accounts this machine has logged in with and been told to remember.
    ///
    /// The client already kept one of these - "remember me" stored a login token and the
    /// name that went with it, and typing a different name threw both away. People here run
    /// two or three logins and were retyping a password every time they swapped, which is
    /// the entire reason this is a list rather than a pair of fields.
    /// </summary>
    /// <remarks>
    /// What is kept is a token, not a password. The server issues one on request, replaces
    /// it with a new one every time it is used, and forgets it when asked - so a token read
    /// off this machine cannot be turned back into anything anybody typed, and cannot be
    /// used twice. Nothing here should ever be given a password to hold.
    /// </remarks>
    public static class SavedAccountStore
    {
        /// <summary>
        /// How many are kept. Past this the oldest falls off the end.
        ///
        /// Five rather than a longer list because every one of them is a row on the title
        /// screen, and that screen has a phone to fit on. Two or three is what anybody
        /// here actually runs.
        /// </summary>
        public const int MaxAccounts = 5;

        public static List<SavedAccount> All
        {
            get
            {
                var data = GameConfig.Data;
                if (data == null)
                    return new List<SavedAccount>();

                //an older config file has no list at all
                return data.SavedAccounts ??= new List<SavedAccount>();
            }
        }

        public static string TokenFor(string accountName)
        {
            if (string.IsNullOrWhiteSpace(accountName))
                return null;

            foreach (var account in All)
            {
                if (account != null && Matches(account.Name, accountName))
                    return account.Token;
            }

            return null;
        }

        /// <summary>
        /// Puts an account at the top of the list with the token it was just given.
        /// </summary>
        /// <remarks>
        /// Moved to the top rather than left where it was, because the order on screen is
        /// the order here and the one used last is the one most likely to be wanted next.
        /// A token replaces the old one every time: the server issues a new one on each
        /// login and the previous is no longer accepted, so keeping the old would leave a
        /// row that looks like it works and does not.
        /// </remarks>
        public static void Remember(string accountName, string token)
        {
            if (string.IsNullOrWhiteSpace(accountName) || string.IsNullOrWhiteSpace(token))
                return;

            var list = All;
            list.RemoveAll(a => a == null || Matches(a.Name, accountName));
            list.Insert(0, new SavedAccount { Name = accountName, Token = token });

            while (list.Count > MaxAccounts)
                list.RemoveAt(list.Count - 1);

            GameConfig.SaveConfig();
        }

        public static void Forget(string accountName)
        {
            if (string.IsNullOrWhiteSpace(accountName))
                return;

            All.RemoveAll(a => a == null || Matches(a.Name, accountName));
            GameConfig.SaveConfig();
        }

        //Account names are matched the way the server matches them, which is without
        //regard to case - otherwise logging in as "Bob" leaves a second row next to "bob"
        //and one of the two carries a token the server has already replaced.
        private static bool Matches(string a, string b) =>
            !string.IsNullOrEmpty(a) && string.Equals(a, b, System.StringComparison.OrdinalIgnoreCase);
    }
}
