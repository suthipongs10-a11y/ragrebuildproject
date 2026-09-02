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
        private GameObject minimapContent;
        private Slider minimapZoom;
        private GameObject minimapEmpty;
        private MinimapController minimapController;
        private TextMeshProUGUI minimapPopulation;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.SkinsEnabled)
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

            //No size test any more, and that was the whole bug. This readout is laid out
            //by a vertical group with a content size fitter, so its own rect carries a
            //height of zero until a layout pass has run on an active object. The guard
            //that was here waited for a height above forty before doing anything, and
            //nothing it was guarding against could happen anyway: the component being
            //a CharacterDetailBox is already proof of what it is.
            ModernUiTheme.MarkSkinned(box.gameObject);

            //The readout already carries a dark backdrop of its own. Adding a pale panel
            //behind that did nothing except leave the dark one on top, so the near black
            //ink went onto a near black panel. Repaint the backdrop it has rather than
            //stacking a second one behind it, and only build one where there is none.
            Image backdrop = FindBackdrop(root);
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

            //Every label in here is drawn again from nothing. The ones the prefab shipped
            //carry a dark outline and a drop shadow baked into their own material, and at
            //this size the outline is most of the stroke, so the reading came out smeared
            //rather than sharp. Stripping those off the material fixes some of them and
            //not others, because several share a material with text elsewhere. Building
            //the labels fresh in the theme's own crisp material settles it for all of them
            //at once, and the box's references are moved onto the new ones so every write
            //the client makes still lands.
            box.CharacterName = RebuildLabel(box.CharacterName);
            box.CharacterJob = RebuildLabel(box.CharacterJob);
            box.CharacterZeny = RebuildLabel(box.CharacterZeny);
            box.CharacterWeight = RebuildLabel(box.CharacterWeight);
            box.HpDisplay = RebuildLabel(box.HpDisplay);
            box.SpDisplay = RebuildLabel(box.SpDisplay);
            box.ExpDisplay = RebuildLabel(box.ExpDisplay);
            box.JobExpDisplay = RebuildLabel(box.JobExpDisplay);
            box.BaseLvlDisplay = RebuildLabel(box.BaseLvlDisplay);
            box.JobLvlDisplay = RebuildLabel(box.JobLvlDisplay);

            ModernUiTheme.RepaintInk(root);

            //Four flat rectangles in four bright colours, with the reading printed across
            //them in white that did not contrast with any of them. They become sunken
            //channels with a lit bar inside, and each hue is darkened to the point where
            //the reading on top of it is actually readable.
            ModernUiTheme.StyleGauge(box.HpSlider, ModernUiTheme.GaugeHealthColor);
            ModernUiTheme.StyleGauge(box.SpSlider, ModernUiTheme.GaugeManaColor);
            ModernUiTheme.StyleGauge(box.ExpSlider, ModernUiTheme.GaugeExpColor);
            ModernUiTheme.StyleGauge(box.JobExpSlider, ModernUiTheme.GaugeJobExpColor);

            //set after the ink pass, which cannot see that these sit on a dark channel:
            //the reading spans the filled part and the empty part both, so it takes the
            //ink for the darker of the two
            StyleGaugeLabel(box.HpDisplay);
            StyleGaugeLabel(box.SpDisplay);
            StyleGaugeLabel(box.ExpDisplay);
            StyleGaugeLabel(box.JobExpDisplay);

            foreach (var text in root.GetComponentsInChildren<TextMeshProUGUI>(true))
                text.extraPadding = true;

            //the measured size is in here because a size test is what stopped this
            //running at all, and the log is how that gets caught next time
            Debug.Log($"[ModernHudSkin] Repainted the character readout ({root.rect.width:0}x{root.rect.height:0}, "
                      + $"backdrop {(backdrop != null ? backdrop.name : "none")}).");
        }

        //the rebuild that fixed this readout now lives in the theme, because the bag's
        //stack counts and its weight line needed exactly the same treatment
        private static TextMeshProUGUI RebuildLabel(TextMeshProUGUI original) =>
            ModernUiTheme.RebuildLabel(original);

        private static void StyleGaugeLabel(TextMeshProUGUI text)
        {
            if (text == null)
                return;

            text.color = ModernUiTheme.LightInkColor;
            text.fontStyle = FontStyles.Bold;
            text.extraPadding = true;
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

            //No frame around it. One was tried and it was wrong: the minimap is a window
            //onto the world rather than a panel of the interface, and a blue rule around
            //the edge made it look like a dialog that had failed to close. What the corner
            //of the screen wants there is the map and nothing else.
            var staleFrame = root.Find("ModernMinimapFrame");
            if (staleFrame != null)
                Destroy(staleFrame.gameObject);

            //A map with no minimap rendered for it yet leaves this corner of the screen
            //completely blank, which reads as the widget being broken rather than as the
            //picture being absent. Saying so is the difference between a bug and a step
            //that has not been run.
            var existingEmpty = root.Find("ModernMinimapEmpty");
            if (existingEmpty != null)
            {
                minimapEmpty = existingEmpty.gameObject;
            }
            else
            {
                var card = ModernUiTheme.CreateCard(root, "ModernMinimapEmpty",
                    ModernUiTheme.PanelOverlayColor, true);
                ModernUiTheme.Stretch(card, 0, 0, 0, 0);
                card.GetComponent<Image>().raycastTarget = false;

                var hint = ModernUiTheme.CreateText(card, "Hint", "ยังไม่มีแผนที่ย่อ",
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor, TextAlignmentOptions.Center);
                ModernUiTheme.Stretch(hint.rectTransform, 8, 8, -8, -8);

                minimapEmpty = card.gameObject;
            }

            //How busy the map is, which the client already knows: every player on it is
            //registered as an important entity so their marker can be drawn, and counting
            //those markers is the same number without asking the server for anything.
            if (root.Find("ModernMinimapCount") == null)
            {
                var chip = ModernUiTheme.CreateCard(root, "ModernMinimapCount",
                    ModernUiTheme.PanelOverlayColor, true);
                ModernUiTheme.Place(chip, new Vector2(0, 0), new Vector2(6f, 6f), new Vector2(74f, 22f));
                chip.GetComponent<Image>().raycastTarget = false;

                var icon = ModernUiTheme.CreateIcon(chip, ModernUiIcons.Person, ModernUiTheme.AccentInkColor, 13);
                ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(8f, 0f),
                    new Vector2(13f, 13f));

                minimapPopulation = ModernUiTheme.CreateText(chip, "Count", "1", ModernUiTheme.SizeSmall,
                    ModernUiTheme.NameColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Stretch(minimapPopulation.rectTransform, 26f, 0f, -6f, 0f);
            }
            else
            {
                minimapPopulation = root.Find("ModernMinimapCount/Count")?.GetComponent<TextMeshProUGUI>();
            }

            minimapController = map;
            minimapContent = map.ContentContainer;
            minimapZoom = map.ZoomSlider;
            ModernUiTheme.StyleSliders(root);

            Debug.Log("[ModernHudSkin] Framed the minimap.");
        }

        /// <summary>
        /// Hides everything that only makes sense with a map behind it. Which map has a
        /// picture depends on what has been rendered by the lighting tool, and it changes
        /// on every warp, so this is checked on the same beat as everything else rather
        /// than once.
        /// </summary>
        private void SyncMinimapFrame()
        {
            if (minimapEmpty == null && minimapPopulation == null)
                return;

            //Read off the content container, not off MapImage. The map is drawn through a
            //material with the texture set on it, so MapImage.sprite is null even when a
            //map is showing, and checking that was why an empty frame stayed on screen.
            //LoadMinimapCoroutine switches the container on as its very last step and
            //gives up before reaching it whenever a map has no minimap rendered yet.
            var hasMap = minimapContent != null && minimapContent.activeInHierarchy;

            //the zoom slider goes with it. Left behind on its own it was a lone blue dot
            //on a rule down the edge of the screen, with nothing to say what it zoomed.
            if (minimapZoom != null && minimapZoom.gameObject.activeSelf != hasMap)
                minimapZoom.gameObject.SetActive(hasMap);

            if (minimapEmpty != null && minimapEmpty.activeSelf == hasMap)
                minimapEmpty.SetActive(!hasMap);

            if (minimapPopulation == null)
                return;

            if (minimapPopulation.transform.parent.gameObject.activeSelf != hasMap)
                minimapPopulation.transform.parent.gameObject.SetActive(hasMap);

            //plus one for the player reading it, who is on the map but is not one of the
            //markers drawn on it
            if (hasMap && minimapController != null)
                minimapPopulation.text = (minimapController.CountTrackedPlayers() + 1).ToString();
        }
    }
}
