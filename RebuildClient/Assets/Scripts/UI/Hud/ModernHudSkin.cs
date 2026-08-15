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
        private GameObject minimapContent;

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

            //The readout already carries a dark backdrop of its own. Adding a pale panel
            //behind that did nothing except leave the dark one on top, so the near black
            //ink went onto a near black panel. Repaint the backdrop it has rather than
            //stacking a second one behind it, and only build one where there is none.
            var backdrop = FindBackdrop(root);
            if (backdrop != null)
            {
                backdrop.sprite = ModernUiTheme.RoundedSprite;
                backdrop.type = Image.Type.Sliced;
                backdrop.color = ModernUiTheme.PanelOverlayColor;
                ModernUiTheme.AddBorder((RectTransform)backdrop.transform, ModernUiTheme.CardBorderColor);
            }
            else if (root.Find("ModernDetailsCard") == null)
            {
                var card = ModernUiTheme.CreateCard(root, "ModernDetailsCard", ModernUiTheme.PanelOverlayColor, true);
                ModernUiTheme.Stretch(card, -12, -10, 12, 10);
                card.GetComponent<Image>().raycastTarget = false;
                card.SetAsFirstSibling();
            }

            //the bars keep their own colours, they are saying how much health is left
            ModernUiTheme.RepaintInk(root);
            foreach (var text in root.GetComponentsInChildren<TextMeshProUGUI>(true))
                text.extraPadding = true;

            Debug.Log("[ModernHudSkin] Repainted the character readout.");
        }

        /// <summary>
        /// The image an element is actually read against: the one on the element itself,
        /// or failing that the child large enough to be covering it rather than being a
        /// bar or an icon sitting on it.
        /// </summary>
        private static Image FindBackdrop(RectTransform root)
        {
            var own = root.GetComponent<Image>();
            if (own != null && own.color.a > 0.15f)
                return own;

            var area = root.rect.width * root.rect.height;
            if (area <= 0f)
                return null;

            for (var i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i) as RectTransform;
                if (child == null)
                    continue;

                var image = child.GetComponent<Image>();
                if (image == null || image.color.a <= 0.15f)
                    continue;

                if (child.rect.width * child.rect.height >= area * 0.7f)
                    return image;
            }

            return null;
        }

        private static void SkinDialog(DialogWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            ModernUiTheme.ApplyWindowChrome(win);
            ModernUiTheme.AttachShadow(root);

            if (win.NameBox != null)
            {
                win.NameBox.color = ModernUiTheme.AccentInkColor;
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

            ModernUiTheme.RepaintInk(root);
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

            ModernUiTheme.RepaintInk(root);
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
                label.color = ModernUiTheme.AccentInkColor;
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

            minimapContent = map.ContentContainer;
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

            //Read off the content container, not off MapImage. The map is drawn through a
            //material with the texture set on it, so MapImage.sprite is null even when a
            //map is showing, and checking that was why an empty frame stayed on screen.
            //LoadMinimapCoroutine switches the container on as its very last step and
            //gives up before reaching it whenever a map has no minimap rendered yet.
            var hasMap = minimapContent != null && minimapContent.activeInHierarchy;
            if (minimapFrame.enabled != hasMap)
                minimapFrame.enabled = hasMap;
        }
    }
}
