using Assets.Scripts.UI;
using UnityEditor;
using UnityEngine;

namespace Assets.Scripts.Editor
{
    /// <summary>
    /// Puts the game's own window skin back without giving anything up.
    /// </summary>
    /// <remarks>
    /// There are two switches and this is the narrow one. ModernUiTheme.RuntimeUiEnabled
    /// removes everything the project adds at runtime, which sounds like what "the old
    /// interface" means until you use it: the market, the adventure book, the guild and
    /// party pages and the graphics settings have no button in the game's own interface,
    /// because they are not the game's - they are reached through the dock bar and the
    /// character hub, and those go too.
    ///
    /// SkinsEnabled is the one that means what a player means. A skin is paint over a window
    /// the scene already contains; switching it off leaves that window to draw itself the
    /// way the game shipped it. Every window the project added is still there, still
    /// reachable, and the interface is still in Thai.
    ///
    /// The flag was there for WebGL already - ?vanillaskin=1 in the page address - but
    /// Application.absoluteURL is empty outside a browser, so a Play session in the editor
    /// could not reach it. This writes the same decision somewhere the editor can read, and
    /// no file is touched in either direction.
    /// </remarks>
    public static class VanillaUiToggle
    {
        private const string MenuPath = "Ragnarok/Use the original window skin";

        [MenuItem(MenuPath, priority = 300)]
        private static void Toggle()
        {
            var vanilla = !EditorPrefs.GetBool(ModernUiTheme.VanillaUiPrefKey, false);
            EditorPrefs.SetBool(ModernUiTheme.VanillaUiPrefKey, vanilla);

            Debug.Log(vanilla
                ? "[ModernUi] The game's own window skin will be used the next time you press Play. Everything this project added stays where it is."
                : "[ModernUi] This project's window skin will be used the next time you press Play.");
        }

        /// <summary>Puts the tick beside the menu item when the original skin is on.</summary>
        [MenuItem(MenuPath, true)]
        private static bool ToggleValidate()
        {
            Menu.SetChecked(MenuPath, EditorPrefs.GetBool(ModernUiTheme.VanillaUiPrefKey, false));
            return true;
        }
    }
}
