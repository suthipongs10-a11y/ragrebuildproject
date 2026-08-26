using System.Collections.Generic;
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

        /// <summary>Two lines of Thai: what happened, and the two ways out of it.</summary>
        private const float NoticeHeight = 74f;

        private static readonly Color NoticeColor = new Color(0.996f, 0.910f, 0.910f);
        private static readonly Color NoticeInkColor = new Color(0.681f, 0.102f, 0.140f);

        private static EscMenu instance;

        private Button respawnButton;
        private RectTransform noticeCard;

        /// <summary>The rows in the order they are drawn, so the notice can push them down.</summary>
        private readonly List<RectTransform> entries = new List<RectTransform>();

        private bool noticeShown;

        /// <summary>
        /// Whether the menu put itself on screen because the character died, as against the
        /// player asking for it. Only a menu that opened itself takes itself away again.
        /// </summary>
        private bool openedByDeath;

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

        /// <summary>
        /// Opens the menu because the player's own character has just died.
        ///
        /// Dying leaves the character lying there with no sign of what to do about it - the
        /// only instruction was a line of chat naming a key, which on a phone is not a key at
        /// all. This is the same menu escape opens, so respawning and logging out are both a
        /// tap away, with a line at the top saying why it appeared.
        /// </summary>
        public static void OpenOnDeath()
        {
            Open();
            if (instance != null)
                instance.openedByDeath = true;
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

            ModernUiTheme.CreateTitleBar(menu, ThaiUiText.Get("Menu"), ThaiUiText.Get("System"), ModernUiIcons.Gear);
            ModernUiTheme.AttachShadow(rect);

            menu.noticeCard = menu.BuildNotice(rect);
            menu.respawnButton = menu.AddEntry(rect, "Respawn", ModernUiIcons.Home, menu.OnRespawn, false);
            menu.AddEntry(rect, "Unstuck", ModernUiIcons.Refresh, menu.OnUnstuck, false);
            menu.AddEntry(rect, "Shortcut", ModernUiIcons.Grid, menu.OnShortcut, false);
            menu.AddEntry(rect, "Logout", ModernUiIcons.Exit, menu.OnLogout, false);
            menu.AddEntry(rect, "Cancel", ModernUiIcons.Close, menu.CloseWindow, true);
            menu.LayoutBody(false);

            host.SetActive(true);
            return menu;
        }

        /// <summary>
        /// The red line at the top saying the character is dead.
        ///
        /// Built once and hidden while alive rather than made when somebody dies: putting
        /// the menu up at that moment is then a SetActive and a relayout, and nothing that
        /// can half fail is being run in the middle of a death.
        /// </summary>
        private RectTransform BuildNotice(RectTransform parent)
        {
            var card = ModernUiTheme.CreateCard(parent, "DeathNotice", NoticeColor);
            ModernUiTheme.AddBorder(card, NoticeInkColor);

            var title = ModernUiTheme.CreateText(card, "Title", ThaiUiText.Get("You Died"),
                ModernUiTheme.SizeValue, NoticeInkColor, TextAlignmentOptions.Center, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)title.transform, new Vector2(0, 1),
                new Vector2(0, -8), new Vector2(MenuWidth - Padding * 2, 26));

            var hint = ModernUiTheme.CreateText(card, "Hint", ThaiUiText.Get("You Died Hint"),
                ModernUiTheme.SizeSmall, NoticeInkColor, TextAlignmentOptions.Top);
            ModernUiTheme.Place((RectTransform)hint.transform, new Vector2(0, 1),
                new Vector2(10, -34), new Vector2(MenuWidth - Padding * 2 - 20, 34));
            hint.textWrappingMode = TextWrappingModes.Normal;

            card.gameObject.SetActive(false);
            return card;
        }

        private Button AddEntry(RectTransform parent, string label, Sprite icon,
            UnityEngine.Events.UnityAction action, bool isCancel)
        {
            var background = isCancel ? ModernUiTheme.CardDeepColor : ModernUiTheme.CardColor;
            var button = ModernUiTheme.CreateIconButton(parent, label, ThaiUiText.Get(label), icon, background,
                ModernUiTheme.NameColor);
            button.onClick.AddListener(action);
            entries.Add((RectTransform)button.transform);
            return button;
        }

        /// <summary>
        /// Stacks the notice and the buttons from the top and sizes the window to what that
        /// came to, rather than to a count of rows worked out by hand. The notice appears and
        /// disappears, so the height it takes is measured here and nowhere else.
        /// </summary>
        private void LayoutBody(bool showNotice)
        {
            noticeShown = showNotice;

            var width = MenuWidth - Padding * 2;
            var y = -(ModernUiTheme.TitleBarHeight + Padding);

            if (noticeCard != null)
            {
                noticeCard.gameObject.SetActive(showNotice);
                if (showNotice)
                {
                    ModernUiTheme.Place(noticeCard, new Vector2(0, 1), new Vector2(Padding, y),
                        new Vector2(width, NoticeHeight));
                    y -= NoticeHeight + ButtonGap;
                }
            }

            foreach (var entry in entries)
            {
                ModernUiTheme.Place(entry, new Vector2(0, 1), new Vector2(Padding, y),
                    new Vector2(width, ButtonHeight));
                y -= ButtonHeight + ButtonGap;
            }

            //y carries one gap too many, the one left after the last row
            ((RectTransform)transform).sizeDelta = new Vector2(MenuWidth, -y - ButtonGap + Padding);
        }

        private void RefreshButtons()
        {
            var controllable = CameraFollower.Instance != null ? CameraFollower.Instance.TargetControllable : null;
            var isDead = controllable != null && !controllable.IsCharacterAlive;

            //the server only honours a respawn request from a dead character, so the
            //button is greyed out rather than silently doing nothing
            if (respawnButton != null)
                respawnButton.interactable = isDead;

            if (isDead != noticeShown)
                LayoutBody(isDead);
        }

        /// <summary>
        /// Watches for the character getting up again.
        ///
        /// Respawning with the R key, and being resurrected by somebody else, both happen
        /// without this window hearing about it. Left alone it would go on telling a living
        /// character that they are dead, so the state is read back rather than assumed to
        /// still be what it was when the menu opened.
        /// </summary>
        private void Update()
        {
            if (!noticeShown)
                return;

            var controllable = CameraFollower.Instance != null ? CameraFollower.Instance.TargetControllable : null;
            if (controllable == null || !controllable.IsCharacterAlive)
                return;

            RefreshButtons();

            if (openedByDeath)
                CloseWindow();
        }

        public override void CloseWindow()
        {
            openedByDeath = false;
            base.CloseWindow();
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
