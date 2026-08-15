using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    /// <summary>
    /// Themes the parts of the interface that belong to the game itself rather than to a
    /// window the player opens: the NPC talk box, the list of replies it offers, and the
    /// minimap. None of these is a WindowBase living in the window container, so the
    /// general sweep never reaches them and each is picked up by name here.
    ///
    /// The minimap image itself is deliberately left alone. It is a photograph of the
    /// real map taken by the lighting tool, so its colours already match the world; a
    /// tint applied here would be the one thing that broke that.
    /// </summary>
    public class ModernHudSkin : MonoBehaviour
    {
        private const float SearchInterval = 0.5f;

        private float searchTimer;
        private Image minimapFrame;
        private Image minimapImage;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernHudSkin>() != null)
                return;

            var host = new GameObject("ModernHudSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernHudSkin>();
        }

        private void Update()
        {
            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            var dialog = FindFirstObjectByType<DialogWindow>(FindObjectsInactive.Include);
            if (dialog != null && !ModernUiTheme.IsSkinned(dialog.gameObject))
                SkinDialog(dialog);

            var options = FindFirstObjectByType<NpcOptionWindow>(FindObjectsInactive.Include);
            if (options != null && !ModernUiTheme.IsSkinned(options.gameObject))
                SkinOptions(options);

            var minimap = MinimapController.Instance;
            if (minimap != null && !ModernUiTheme.IsSkinned(minimap.gameObject))
                SkinMinimap(minimap);
            SyncMinimapFrame();

            var details = FindFirstObjectByType<CharacterDetailBox>(FindObjectsInactive.Include);
            if (details != null && !ModernUiTheme.IsSkinned(details.gameObject))
                SkinCharacterDetails(details);
        }

        /// <summary>
        /// The name, level, health and weight readout in the top corner is drawn straight
        /// onto the world, so how legible it is depends entirely on what the player happens
        /// to be standing in front of. A panel of its own behind it fixes that, and is what
        /// the rest of the interface already does.
        /// </summary>
        private static void SkinCharacterDetails(CharacterDetailBox box)
        {
            var root = box.transform as RectTransform;
            if (root == null)
            {
                ModernUiTheme.MarkSkinned(box.gameObject);
                return;
            }

            //A rect reporting almost nothing has not been through a layout pass yet, so
            //this leaves it unclaimed and comes back to it. Marking first and measuring
            //second would have written the readout off for the rest of the session.
            var size = root.rect.size;
            if (size.x < 40f || size.y < 40f)
                return;

            ModernUiTheme.MarkSkinned(box.gameObject);

            //a readout is a few hundred points across; anything much larger is not the
            //readout but something stretched over the whole screen, and a panel behind
            //that would black the game out
            if (size.x > 720f || size.y > 480f)
                return;

            if (root.Find("ModernDetailsCard") == null)
            {
                var card = ModernUiTheme.CreateCard(root, "ModernDetailsCard", ModernUiTheme.PanelOverlayColor, true);
                ModernUiTheme.Stretch(card, -12, -10, 12, 10);
                card.GetComponent<Image>().raycastTarget = false;
                card.SetAsFirstSibling();
            }

            //the bars keep their own colours, they are saying how much health is left
            foreach (var text in root.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                text.color = ModernUiTheme.NameColor;
                text.extraPadding = true;
            }

            Debug.Log("[ModernHudSkin] Backed the character readout with a panel.");
        }

        private static void SkinDialog(DialogWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            ModernUiTheme.ApplyWindowChrome(win);
            ModernUiTheme.AttachShadow(root);

            if (win.NameBox != null)
            {
                win.NameBox.color = ModernUiTheme.AccentColor;
                win.NameBox.fontSize = ModernUiTheme.SizeValue;
                win.NameBox.fontStyle = FontStyles.Bold;
                win.NameBox.extraPadding = true;
            }

            if (win.TextBox != null)
            {
                //dialogue arrives from the script files carrying its own colour tags, so
                //this only sets what an untagged line falls back to
                win.TextBox.color = ModernUiTheme.NameColor;
                win.TextBox.fontSize = ModernUiTheme.SizeBody;
                win.TextBox.extraPadding = true;
            }

            ModernUiTheme.RecolorLightTexts(root);
            ModernUiTheme.RecolorAccents(root);
            ThaiUiText.ApplyToControls(root);

            Debug.Log("[ModernHudSkin] Retinted the NPC dialog.");
        }

        private static void SkinOptions(NpcOptionWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            ModernUiTheme.ApplyWindowChrome(win);
            ModernUiTheme.AttachShadow(root);

            //every reply the player is offered is cloned from this one, so styling the
            //template covers the choices for every NPC from here on
            if (win.TemplateButton != null)
                StyleOptionButton(win.TemplateButton);

            if (win.ButtonGroup != null)
            {
                var group = win.ButtonGroup.transform;
                for (var i = 0; i < group.childCount; i++)
                    StyleOptionButton(group.GetChild(i).gameObject);
            }

            ModernUiTheme.RecolorLightTexts(root);
            ModernUiTheme.RecolorAccents(root);

            Debug.Log("[ModernHudSkin] Retinted the NPC reply list.");
        }

        private static void StyleOptionButton(GameObject target)
        {
            if (target == null)
                return;

            var image = target.GetComponent<Image>();
            if (image != null)
            {
                image.sprite = ModernUiTheme.RoundedSprite;
                image.type = Image.Type.Sliced;
                image.color = ModernUiTheme.CardColor;
            }

            foreach (var label in target.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                label.color = ModernUiTheme.AccentColor;
                label.fontSize = ModernUiTheme.SizeBody;
                label.fontStyle = FontStyles.Bold;
                label.extraPadding = true;
            }
        }

        private void SkinMinimap(MinimapController map)
        {
            ModernUiTheme.MarkSkinned(map.gameObject);

            //the controller does not have to be the one holding the layout rect, so this
            //checks rather than casts
            var root = map.transform as RectTransform;
            if (root == null)
                return;

            //An outline rather than a filled plate. A filled one was a mistake: on a map
            //with no minimap image rendered for it yet the picture is simply absent, and
            //the plate meant for the back of it became a large blue rectangle sitting over
            //the corner of the screen with nothing in it.
            var existing = root.Find("ModernMinimapFrame");
            if (existing != null)
            {
                minimapFrame = existing.GetComponent<Image>();
            }
            else
            {
                var go = new GameObject("ModernMinimapFrame", typeof(Image));
                go.transform.SetParent(root, false);

                minimapFrame = go.GetComponent<Image>();
                minimapFrame.sprite = ModernUiTheme.OutlineSprite;
                minimapFrame.type = Image.Type.Sliced;
                minimapFrame.color = ModernUiTheme.AccentColor;
                minimapFrame.raycastTarget = false;

                ModernUiTheme.Stretch((RectTransform)go.transform, -3, -3, 3, 3);
            }

            minimapImage = map.MapImage;
            ModernUiTheme.StyleSliders(root);

            Debug.Log("[ModernHudSkin] Framed the minimap.");
        }

        /// <summary>
        /// Hides the frame whenever there is no map behind it. Which map has a picture
        /// depends on what has been rendered by the lighting tool, and it changes on every
        /// warp, so this is checked on the same beat as everything else rather than once.
        /// </summary>
        private void SyncMinimapFrame()
        {
            if (minimapFrame == null)
                return;

            var hasMap = minimapImage != null && minimapImage.sprite != null && minimapImage.enabled;
            if (minimapFrame.enabled != hasMap)
                minimapFrame.enabled = hasMap;
        }
    }
}
