using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.UI.ConfigWindow;
using RebuildSharedData.Networking;
using TMPro;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// The system menu that escape opens when nothing else is on screen: respawn,
    /// unstuck, the shortcut bar, and logging out. Built from code in the shared theme
    /// and registered as a window, so a second press of escape closes it the same way
    /// it closes anything else.
    /// </summary>
    public class EscMenu : WindowBase
    {
        private const float MenuWidth = 320f;
        private const float ButtonHeight = 48f;
        private const float ButtonGap = 8f;
        private const float Padding = 16f;

        private static EscMenu instance;

        private Button respawnButton;

        /// <summary>
        /// Opens the menu, creating it the first time it is asked for. Escape reaches
        /// this only once CloseLastWindow reports it had nothing left to close.
        /// </summary>
        public static void Open()
        {
            if (instance == null)
                instance = Build();

            if (instance == null)
                return;

            instance.gameObject.SetActive(true);
            instance.RefreshButtons();
            instance.MoveToTop();
        }

        private static EscMenu Build()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            //assembled inactive so nothing runs against a half built menu
            var host = new GameObject("EscMenu", typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var menu = host.AddComponent<EscMenu>();
            menu.CanCloseWithEscape = true;
            //already built in the theme, so the general retint pass leaves it be
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;

            var entries = 5;
            var height = ModernUiTheme.TitleBarHeight + Padding + entries * ButtonHeight
                         + (entries - 1) * ButtonGap + Padding;
            rect.sizeDelta = new Vector2(MenuWidth, height);

            ModernUiTheme.CreateTitleBar(menu, "Menu", "เมนู", ModernUiIcons.Gear);
            ModernUiTheme.AttachShadow(rect);

            var y = -(ModernUiTheme.TitleBarHeight + Padding);
            menu.respawnButton = menu.AddEntry(rect, "Respawn", ModernUiIcons.Home, ref y, menu.OnRespawn, false);
            menu.AddEntry(rect, "Unstuck", ModernUiIcons.Refresh, ref y, menu.OnUnstuck, false);
            menu.AddEntry(rect, "Shortcut", ModernUiIcons.Grid, ref y, menu.OnShortcut, false);
            menu.AddEntry(rect, "Logout", ModernUiIcons.Exit, ref y, menu.OnLogout, false);
            menu.AddEntry(rect, "Cancel", ModernUiIcons.Close, ref y, menu.CloseWindow, true);

            host.SetActive(true);
            return menu;
        }

        private Button AddEntry(RectTransform parent, string label, Sprite icon, ref float y,
            UnityEngine.Events.UnityAction action, bool isCancel)
        {
            var background = isCancel ? ModernUiTheme.CardDeepColor : ModernUiTheme.CardColor;
            var button = ModernUiTheme.CreateIconButton(parent, label, label, icon, background,
                ModernUiTheme.NameColor);
            ModernUiTheme.Place((RectTransform)button.transform, new Vector2(0, 1),
                new Vector2(Padding, y), new Vector2(MenuWidth - Padding * 2, ButtonHeight));
            button.onClick.AddListener(action);
            y -= ButtonHeight + ButtonGap;
            return button;
        }

        private void RefreshButtons()
        {
            //the server only honours a respawn request from a dead character, so the
            //button is greyed out rather than silently doing nothing
            if (respawnButton == null)
                return;

            var controllable = CameraFollower.Instance != null ? CameraFollower.Instance.TargetControllable : null;
            respawnButton.interactable = controllable != null && !controllable.IsCharacterAlive;
        }

        private void OnRespawn()
        {
            NetworkManager.Instance.SendRespawn(false);
            CloseWindow();
        }

        private void OnUnstuck()
        {
            //returns to the save point rather than teleporting somewhere random on the
            //same map, which is what actually gets a stuck character out of trouble
            NetworkManager.Instance.SendClientTextCommand(ClientTextCommand.ReturnToSave);
            CloseWindow();
        }

        private void OnShortcut()
        {
            var hotbar = UiManager.Instance != null ? UiManager.Instance.SkillHotbar : null;
            if (hotbar != null)
                hotbar.ToggleVisibility();
            CloseWindow();
        }

        private void OnLogout()
        {
            GameConfig.SaveConfig();
            NetworkManager.Instance.Disconnect();
            SceneManager.LoadScene(0);
        }
    }
}
