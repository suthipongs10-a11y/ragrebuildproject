using Assets.Scripts.UI.ConfigWindow;
using UnityEngine.SceneManagement;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// Puts a player back at the character select screen without making them log in again.
    /// </summary>
    /// <remarks>
    /// Character select lives in the title scene, and the title scene is torn down the moment
    /// a character enters the world - SceneTransitioner destroys it outright, with a note
    /// saying it would be wanted again the day somebody implemented this. Coming back to it
    /// therefore means loading that scene, and loading a scene takes the connection with it,
    /// because the socket belongs to a NetworkManager that lives in the scene being replaced.
    ///
    /// So the connection really is made from scratch, exactly as the logout button makes it.
    /// What is saved is the part the player notices: typing a password to get back somewhere
    /// they were already signed in. The login that worked is kept here, replayed on the far
    /// side of the scene load, and character select opens on its own.
    ///
    /// Static, because static is the only thing SceneManager.LoadScene does not destroy.
    ///
    /// Nothing here is written to disk. NetworkManager already holds the same password in a
    /// field for as long as the client runs; this is that field, kept a few seconds longer.
    /// </remarks>
    public static class LoginReconnect
    {
        private static string serverUrl;
        private static string accountName;

        /// <summary>The password, or the base64 login token when the login used one.</summary>
        private static string secret;

        private static bool usedToken;
        private static bool askedForToken;
        private static bool hasLogin;

        /// <summary>
        /// Raised on the way out of the world, read once on the way back into the title
        /// scene. It outlives the scene load the same way the rest of this does, so it has
        /// to be cleared the moment it is read - otherwise the next ordinary visit to the
        /// title screen would log itself in too.
        /// </summary>
        private static bool resumeRequested;

        public static bool IsResumePending => resumeRequested;

        public static string AccountName => accountName;

        /// <summary>
        /// The password to put back in the box for a player who has to press login by hand
        /// after all, or null when there is nothing worth putting there. A token login has
        /// no password to give back - the box only ever held a placeholder for one - and the
        /// title screen fills that case in for itself from the stored token.
        /// </summary>
        public static string PasswordToRestore => usedToken ? null : secret;

        /// <summary>Records a login as it is attempted, so it can be made again later.</summary>
        public static void Remember(string url, string account, string passwordOrToken, bool isTokenLogin, bool askForToken)
        {
            serverUrl = url;
            accountName = account;
            secret = passwordOrToken;
            usedToken = isTokenLogin;
            askedForToken = askForToken;
            hasLogin = !string.IsNullOrEmpty(url) && !string.IsNullOrEmpty(account);
        }

        /// <summary>Drops the stored login, for somebody who meant to leave properly.</summary>
        public static void Forget()
        {
            serverUrl = null;
            accountName = null;
            secret = null;
            usedToken = false;
            askedForToken = false;
            hasLogin = false;
            resumeRequested = false;
        }

        /// <summary>
        /// Leaves the world for the character select screen. Everything below the first line
        /// is what the escape menu's own logout does, and for the same reasons - the settings
        /// are written out, the socket is closed politely so the server is not left waiting
        /// on a timeout, and the title scene is loaded.
        /// </summary>
        public static void ReturnToCharacterSelect()
        {
            //without a login to make again this is a logout, which is still the honest
            //answer to the request: it does reach character select, just by way of the
            //login box. Better than a button that does nothing at all.
            resumeRequested = hasLogin;

            GameConfig.SaveConfig();
            NetworkManager.Instance.Disconnect();
            SceneManager.LoadScene(0);
        }

        /// <summary>
        /// Logs back in, if this trip to the title screen is one the escape menu asked for.
        /// Answers whether it took the login over, so the caller knows whether the player is
        /// meant to be typing.
        /// </summary>
        public static bool TryResume()
        {
            if (!resumeRequested)
                return false;

            resumeRequested = false; //one login per request, however this turns out

            if (!hasLogin)
                return false;

            var pass = secret;
            if (usedToken)
            {
                //A token is spent the moment it is used: the server hands back a new one and
                //forgets the old. The token that got us in is worthless by now, so the one to
                //use is the replacement the client wrote down when it arrived.
                pass = GameConfig.Data?.SavedLoginToken;
                if (string.IsNullOrWhiteSpace(pass))
                    return false;
                secret = pass;
            }

            var network = NetworkManager.Instance;
            if (network == null || network.TitleScreen == null)
                return false;

            network.StartConnectWithRegularLogin(serverUrl, accountName, pass, usedToken, askedForToken);

            //the same timer the login button starts, so a connection that never answers ends
            //up back at the login box instead of at a title screen that sits there forever
            network.TitleScreen.StartLoginTimer();
            return true;
        }
    }
}
