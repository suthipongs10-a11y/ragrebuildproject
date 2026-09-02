using Assets.Scripts.UI;
using UnityEditor;
using UnityEngine;

namespace Assets.Scripts.Editor
{
    /// <summary>
    /// Switches between this project's interface and the one the game shipped with.
    /// </summary>
    /// <remarks>
    /// The flag itself is not new - a WebGL build has always understood ?vanillaui=1 in the
    /// page address, which turns every runtime skin off. Application.absoluteURL is empty
    /// outside a browser, though, so that switch could not be reached from a Play session in
    /// the editor, which is the only place the game is being run at the moment. This writes
    /// the same decision somewhere the editor can read.
    ///
    /// Nothing is deleted, moved or overwritten. The skins are applied at load time on top
    /// of the windows the scene already contains, so switching them off just leaves those
    /// windows alone; switching back puts the skins on again at the next Play. Both
    /// directions are one click and neither touches a file.
    /// </remarks>
    public static class VanillaUiToggle
    {
        private const string MenuPath = "Ragnarok/Use the original interface";

        [MenuItem(MenuPath, priority = 300)]
        private static void Toggle()
        {
            var vanilla = !EditorPrefs.GetBool(ModernUiTheme.VanillaUiPrefKey, false);
            EditorPrefs.SetBool(ModernUiTheme.VanillaUiPrefKey, vanilla);

            Debug.Log(vanilla
                ? "[ModernUi] The original interface will be used the next time you press Play."
                : "[ModernUi] This project's interface will be used the next time you press Play.");
        }

        /// <summary>Puts the tick beside the menu item when the original interface is on.</summary>
        [MenuItem(MenuPath, true)]
        private static bool ToggleValidate()
        {
            Menu.SetChecked(MenuPath, EditorPrefs.GetBool(ModernUiTheme.VanillaUiPrefKey, false));
            return true;
        }
    }
}
