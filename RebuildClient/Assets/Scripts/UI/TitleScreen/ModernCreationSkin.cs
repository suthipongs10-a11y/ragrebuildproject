using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.TitleScreen
{
    /// <summary>
    /// Rebuilds character creation into the shared card theme. The window's logic is
    /// untouched: the pieces it drives (StatTexts, StatUpButtons, StatDownButtons,
    /// GenderButtons, ColorButtons, SaveButton) are replaced with new ones and assigned
    /// back onto the window, while the parts that carry state of their own, the name
    /// field and the character preview, are moved into the new layout rather than
    /// recreated. Buttons call the window's own public methods.
    /// </summary>
    public class ModernCreationSkin : MonoBehaviour
    {
        private const float SearchInterval = 0.5f;

        private const float PaneWidth = 900f;
        private const float PaneHeight = 580f;
        private const float Margin = 24f;
        private const float TopOffset = 74f;
        private const float ColumnGap = 16f;
        private const float LeftWidth = 260f;
        private const float CenterWidth = 260f;
        private const float RightWidth = 300f;
        private const float StatRowHeight = 42f;
        private const float StatRowGap = 6f;

        /// <summary>Space left around the pane when it has to be shrunk to fit.</summary>
        private const float FitMargin = 12f;

        private static readonly string[] StatNames = { "STR", "AGI", "VIT", "INT", "DEX", "LUK" };

        private static Sprite[] StatIcons => new[]
        {
            ModernUiIcons.Sword, ModernUiIcons.Bolt, ModernUiIcons.Heart,
            ModernUiIcons.Spark, ModernUiIcons.Target, ModernUiIcons.Star
        };

        private float searchTimer;
        private CharacterCreatorWindow creator;
        private TextMeshProUGUI hairStyleLabel;
        private int shownHairStyle = -1;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.SkinsEnabled)
                return;

            if (FindFirstObjectByType<ModernCreationSkin>() != null)
                return;

            var host = new GameObject("ModernCreationSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernCreationSkin>();
        }

        private void Update()
        {
            FitPaneToScreen();

            //the style number is the one readout the window doesn't expose a field for,
            //so it is polled off the public hairStyle value instead
            if (creator != null && hairStyleLabel != null && creator.hairStyle != shownHairStyle)
            {
                shownHairStyle = creator.hairStyle;
                hairStyleLabel.text = $"แบบ {shownHairStyle + 1:00}";
            }

            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            if (creator != null)
                return;

            //On the pane, not on the game object. The creator shares CharacterCreator
            //with the character picker, so marking the object locked the other skin out.
            var found = FindFirstObjectByType<CharacterCreatorWindow>(FindObjectsInactive.Include);
            if (found == null || found.Pane == null || ModernUiTheme.IsSkinned(found.Pane))
                return;

            ApplySkin(found);
        }

        /// <summary>
        /// Shrinks the pane until it is inside the screen, and leaves it alone otherwise.
        /// </summary>
        /// <remarks>
        /// The pane is authored at a fixed 900 by 580, which is a comfortable size on a
        /// monitor and taller than a phone held sideways has room for - a handset in
        /// landscape is often under 450 points high. Centred, that put the top of the pane,
        /// where the name field is, off the top of the screen with no way to reach it: you
        /// could see the stats and the create button and not the box you have to type in.
        ///
        /// Checked every frame rather than once when the skin is applied, because the thing
        /// it depends on changes without anything being rebuilt - a phone gets turned over,
        /// a browser window gets dragged wider. It is two rect reads and a compare when
        /// nothing has moved.
        ///
        /// Never scales up. On a monitor the authored size is the right size.
        /// </remarks>
        private void FitPaneToScreen()
        {
            if (creator == null || creator.Pane == null)
                return;

            var pane = (RectTransform)creator.Pane.transform;

            //localScale is relative to the parent, so the room available has to be measured
            //in the parent's units too - the canvas rect would be the wrong ruler if
            //anything between the two carries a scale.
            var area = pane.parent as RectTransform;
            if (area == null)
                return;

            var room = area.rect.size;
            if (room.x < 1f || room.y < 1f)
                return; //not laid out yet

            var fit = Mathf.Min((room.x - FitMargin * 2f) / PaneWidth,
                                (room.y - FitMargin * 2f) / PaneHeight, 1f);
            if (fit <= 0f)
                return;

            if (Mathf.Abs(pane.localScale.x - fit) > 0.001f)
                pane.localScale = Vector3.one * fit;
        }

        private void ApplySkin(CharacterCreatorWindow win)
        {
            ModernUiTheme.MarkSkinned(win.Pane);
            creator = win;

            var pane = (RectTransform)win.Pane.transform;

            //resizing alone left the pane hanging off the top left, because it kept
            //whatever corner the original layout was pinned to. Centre it explicitly.
            pane.anchorMin = new Vector2(0.5f, 0.5f);
            pane.anchorMax = new Vector2(0.5f, 0.5f);
            pane.pivot = new Vector2(0.5f, 0.5f);
            pane.sizeDelta = new Vector2(PaneWidth, PaneHeight);
            pane.anchoredPosition = Vector2.zero;
            pane.localScale = Vector3.one; //FitPaneToScreen takes it down from here if it has to

            //the starting values were written into the old texts by the window's Awake,
            //so they are read back here rather than assumed
            var startingStats = new string[6];
            for (var i = 0; i < 6 && win.StatTexts != null && i < win.StatTexts.Length; i++)
                startingStats[i] = win.StatTexts[i] != null ? win.StatTexts[i].text : "5";
            var startingPoints = win.StatsRemainingText != null ? win.StatsRemainingText.text : "0";

            var swatchColors = new List<Color>();
            if (win.ColorButtons != null)
            {
                foreach (var swatch in win.ColorButtons)
                {
                    var image = swatch != null ? swatch.GetComponent<Image>() : null;
                    swatchColors.Add(image != null ? image.color : Color.white);
                }
            }

            var backdrop = pane.GetComponent<Image>();
            if (backdrop == null)
                backdrop = win.Pane.AddComponent<Image>();
            backdrop.sprite = ModernUiTheme.RoundedSprite;
            backdrop.type = Image.Type.Sliced;
            backdrop.color = ModernUiTheme.WindowColor;
            backdrop.raycastTarget = true;

            var panel = ModernUiTheme.CreateRect("ModernSkinPanel", pane);
            ModernUiTheme.Stretch(panel, 0, 0, 0, 0);

            //keep the pieces that hold state, they are moved rather than rebuilt
            //a cast would throw if either ever sat on a plain transform, so they are
            //converted softly and simply skipped when they are not rect based
            var preview = win.PlayerSprite != null ? win.PlayerSprite.transform as RectTransform : null;
            var nameField = win.PlayerNameText != null ? win.PlayerNameText.transform as RectTransform : null;

            for (var i = 0; i < pane.childCount; i++)
            {
                var child = pane.GetChild(i);
                if (child == panel)
                    continue;
                child.gameObject.SetActive(false);
            }

            var badge = ModernUiTheme.CreateCard(panel, "TitleIcon", ModernUiTheme.AccentColor);
            ModernUiTheme.Place(badge, new Vector2(0, 1), new Vector2(Margin, -16), new Vector2(38, 38));
            ModernUiTheme.CreateIcon(badge, ModernUiIcons.Person, ModernUiTheme.AccentTextColor, 22);

            var title = ModernUiTheme.CreateText(panel, "Title", ThaiUiText.Get("Create Character"), 26,
                ModernUiTheme.TitleColor, TextAlignmentOptions.BottomLeft, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)title.transform, new Vector2(0, 1),
                new Vector2(Margin + 50, -12), new Vector2(400, 30));

            var subtitle = ModernUiTheme.CreateText(panel, "Subtitle", ThaiUiText.Get("New adventurer"),
                ModernUiTheme.SizeSubtitle, ModernUiTheme.AccentColor, TextAlignmentOptions.TopLeft);
            ModernUiTheme.Place((RectTransform)subtitle.transform, new Vector2(0, 1),
                new Vector2(Margin + 50, -44), new Vector2(400, 22));

            BuildLeftColumn(win, panel, nameField, swatchColors);
            BuildCenterColumn(win, panel, preview);
            BuildRightColumn(win, panel, startingStats, startingPoints);
            BuildFooter(win, panel);

            Debug.Log("[ModernCreationSkin] Rebuilt the character creation window.");
        }

        private void BuildLeftColumn(CharacterCreatorWindow win, RectTransform panel, RectTransform nameField,
            List<Color> swatchColors)
        {
            var card = ModernUiTheme.CreateCard(panel, "IdentityCard", ModernUiTheme.CardColor);
            ModernUiTheme.Place(card, new Vector2(0, 1), new Vector2(Margin, -TopOffset),
                new Vector2(LeftWidth, 404));

            var y = -14f;

            Label(card, "Name", ref y);
            if (nameField != null)
            {
                nameField.SetParent(card, false);
                nameField.gameObject.SetActive(true);
                ModernUiTheme.Place(nameField, new Vector2(0, 1), new Vector2(14, y), new Vector2(LeftWidth - 28, 38));

                var fieldImage = nameField.GetComponent<Image>();
                if (fieldImage != null)
                {
                    fieldImage.sprite = ModernUiTheme.RoundedSprite;
                    fieldImage.type = Image.Type.Sliced;
                    fieldImage.color = Color.white;
                }

                if (win.PlayerNameText.textComponent != null)
                    win.PlayerNameText.textComponent.color = ModernUiTheme.NameColor;
                if (win.PlayerNameText.placeholder is TextMeshProUGUI placeholder)
                {
                    placeholder.color = ModernUiTheme.MutedColor;
                    placeholder.text = ThaiUiText.Get("Character name");
                }
            }
            y -= 48f;

            Label(card, "Gender", ref y);
            var maleButton = ModernUiTheme.CreateButton(card, "Male", ThaiUiText.Get("Male"), ModernUiTheme.AccentColor,
                ModernUiTheme.AccentTextColor, ModernUiTheme.SizeBody);
            ModernUiTheme.Place((RectTransform)maleButton.transform, new Vector2(0, 1),
                new Vector2(14, y), new Vector2((LeftWidth - 34) / 2f, 34));

            var femaleButton = ModernUiTheme.CreateButton(card, "Female", ThaiUiText.Get("Female"), ModernUiTheme.CardDeepColor,
                ModernUiTheme.NameColor, ModernUiTheme.SizeBody);
            ModernUiTheme.Place((RectTransform)femaleButton.transform, new Vector2(0, 1),
                new Vector2(20 + (LeftWidth - 34) / 2f, y), new Vector2((LeftWidth - 34) / 2f, 34));

            maleButton.onClick.AddListener(() => win.ChangeGender(true));
            femaleButton.onClick.AddListener(() => win.ChangeGender(false));
            win.GenderButtons = new[] { maleButton, femaleButton };
            //the window marks the active choice by making that button uninteractable
            maleButton.interactable = false;
            y -= 44f;

            Label(card, "Hair style", ref y);
            var prev = ModernUiTheme.CreateButton(card, "HairPrev", "", ModernUiTheme.CardDeepColor,
                ModernUiTheme.NameColor);
            ModernUiTheme.Place((RectTransform)prev.transform, new Vector2(0, 1), new Vector2(14, y), new Vector2(40, 34));
            ModernUiTheme.CreateIcon((RectTransform)prev.transform, ModernUiIcons.ChevronLeft, ModernUiTheme.NameColor, 15);
            prev.onClick.AddListener(() => win.ChangeHair(false));

            hairStyleLabel = ModernUiTheme.CreateText(card, "HairStyle", "แบบ 01", 17,
                ModernUiTheme.NameColor, TextAlignmentOptions.Center, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)hairStyleLabel.transform, new Vector2(0, 1),
                new Vector2(58, y), new Vector2(LeftWidth - 116, 34));

            var next = ModernUiTheme.CreateButton(card, "HairNext", "", ModernUiTheme.CardDeepColor,
                ModernUiTheme.NameColor);
            ModernUiTheme.Place((RectTransform)next.transform, new Vector2(0, 1),
                new Vector2(LeftWidth - 54, y), new Vector2(40, 34));
            ModernUiTheme.CreateIcon((RectTransform)next.transform, ModernUiIcons.ChevronRight, ModernUiTheme.NameColor, 15);
            next.onClick.AddListener(() => win.ChangeHair(true));
            y -= 44f;

            Label(card, "Hair color", ref y);
            var swatches = new List<Button>();
            const int perRow = 5;
            var swatchSize = (LeftWidth - 28 - (perRow - 1) * 8) / perRow;
            for (var i = 0; i < swatchColors.Count; i++)
            {
                var column = i % perRow;
                var row = i / perRow;

                var swatch = ModernUiTheme.CreateButton(card, $"Swatch{i}", "", swatchColors[i],
                    Color.white, 10);
                ModernUiTheme.Place((RectTransform)swatch.transform, new Vector2(0, 1),
                    new Vector2(14 + column * (swatchSize + 8), y - row * (swatchSize + 8)),
                    new Vector2(swatchSize, swatchSize));

                var captured = i;
                swatch.onClick.AddListener(() => win.ChangeHairColor(captured));
                swatches.Add(swatch);
            }

            if (swatches.Count > 0)
            {
                win.ColorButtons = swatches.ToArray();
                var selected = Mathf.Clamp(win.hairColor, 0, swatches.Count - 1);
                swatches[selected].interactable = false;
            }
        }

        private void BuildCenterColumn(CharacterCreatorWindow win, RectTransform panel, RectTransform preview)
        {
            var card = ModernUiTheme.CreateCard(panel, "PreviewCard", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Place(card, new Vector2(0, 1),
                new Vector2(Margin + LeftWidth + ColumnGap, -TopOffset), new Vector2(CenterWidth, 404));

            if (preview != null)
            {
                preview.SetParent(card, false);
                preview.gameObject.SetActive(true);
                preview.anchorMin = new Vector2(0.5f, 0.5f);
                preview.anchorMax = new Vector2(0.5f, 0.5f);
                preview.pivot = new Vector2(0.5f, 0.5f);
                preview.anchoredPosition = new Vector2(0, 30);
            }

            //the gimbal keeps working from code, it just doesn't earn screen space here
            if (win.StatGimbal != null)
                win.StatGimbal.gameObject.SetActive(false);

            var left = ModernUiTheme.CreateButton(card, "TurnLeft", "", ModernUiTheme.CardColor,
                ModernUiTheme.NameColor);
            ModernUiTheme.Place((RectTransform)left.transform, new Vector2(0, 0),
                new Vector2(28, 16), new Vector2(90, 36));
            ModernUiTheme.CreateIcon((RectTransform)left.transform, ModernUiIcons.ChevronLeft, ModernUiTheme.NameColor, 16);
            left.onClick.AddListener(() => win.TurnCharacter(true));

            var right = ModernUiTheme.CreateButton(card, "TurnRight", "", ModernUiTheme.CardColor,
                ModernUiTheme.NameColor);
            ModernUiTheme.Place((RectTransform)right.transform, new Vector2(1, 0),
                new Vector2(-28, 16), new Vector2(90, 36));
            ModernUiTheme.CreateIcon((RectTransform)right.transform, ModernUiIcons.ChevronRight, ModernUiTheme.NameColor, 16);
            right.onClick.AddListener(() => win.TurnCharacter(false));
        }

        private void BuildRightColumn(CharacterCreatorWindow win, RectTransform panel, string[] startingStats,
            string startingPoints)
        {
            var x = Margin + LeftWidth + ColumnGap + CenterWidth + ColumnGap;

            var card = ModernUiTheme.CreateCard(panel, "StatsCard", ModernUiTheme.CardColor);
            ModernUiTheme.Place(card, new Vector2(0, 1), new Vector2(x, -TopOffset), new Vector2(RightWidth, 404));

            var pointsLabel = ModernUiTheme.CreateText(card, "PointsLabel", ThaiUiText.Get("Points remaining"),
                ModernUiTheme.SizeLabel, ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)pointsLabel.transform, new Vector2(0, 1),
                new Vector2(14, -12), new Vector2(180, 24));

            var points = ModernUiTheme.CreateText(card, "Points", startingPoints, 22,
                ModernUiTheme.AccentColor, TextAlignmentOptions.Right, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)points.transform, new Vector2(1, 1),
                new Vector2(-14, -8), new Vector2(70, 30));
            win.StatsRemainingText = points;

            var texts = new TextMeshProUGUI[6];
            var ups = new Button[6];
            var downs = new Button[6];
            var statIcons = StatIcons;

            for (var i = 0; i < 6; i++)
            {
                var row = ModernUiTheme.CreateCard(card, $"Stat{i}", ModernUiTheme.CardDeepColor);
                ModernUiTheme.Place(row, new Vector2(0, 1),
                    new Vector2(14, -46 - i * (StatRowHeight + StatRowGap)),
                    new Vector2(RightWidth - 28, StatRowHeight));

                var icon = ModernUiTheme.CreateIcon(row, statIcons[i], ModernUiTheme.AccentColor, 18);
                ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(11, 0), new Vector2(18, 18));

                var name = ModernUiTheme.CreateText(row, "Name", StatNames[i], ModernUiTheme.SizeLabel,
                    ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)name.transform, new Vector2(0, 0.5f),
                    new Vector2(37, 0), new Vector2(56, 24));

                var down = ModernUiTheme.CreateButton(row, "Minus", "", ModernUiTheme.CardColor,
                    ModernUiTheme.NameColor);
                ModernUiTheme.Place((RectTransform)down.transform, new Vector2(1, 0.5f),
                    new Vector2(-98, 0), new Vector2(30, 30));
                ModernUiTheme.CreateIcon((RectTransform)down.transform, ModernUiIcons.Minus, ModernUiTheme.NameColor, 13);

                var value = ModernUiTheme.CreateText(row, "Value", startingStats[i] ?? "5", ModernUiTheme.SizeValue,
                    ModernUiTheme.NameColor, TextAlignmentOptions.Center, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)value.transform, new Vector2(1, 0.5f),
                    new Vector2(-52, 0), new Vector2(46, 28));

                var up = ModernUiTheme.CreateButton(row, "Plus", "", ModernUiTheme.AccentColor,
                    ModernUiTheme.AccentTextColor);
                ModernUiTheme.Place((RectTransform)up.transform, new Vector2(1, 0.5f),
                    new Vector2(-12, 0), new Vector2(30, 30));
                ModernUiTheme.CreateIcon((RectTransform)up.transform, ModernUiIcons.Plus, ModernUiTheme.AccentTextColor, 13);

                var captured = i;
                up.onClick.AddListener(() => win.AddStat(captured));
                down.onClick.AddListener(() => win.SubStat(captured));

                texts[i] = value;
                ups[i] = up;
                downs[i] = down;
            }

            win.StatTexts = texts;
            win.StatUpButtons = ups;
            win.StatDownButtons = downs;
        }

        private void BuildFooter(CharacterCreatorWindow win, RectTransform panel)
        {
            var cancel = ModernUiTheme.CreateIconButton(panel, "Cancel", ThaiUiText.Get("Cancel"), ModernUiIcons.Close,
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor);
            ModernUiTheme.Place((RectTransform)cancel.transform, new Vector2(1, 0),
                new Vector2(-Margin - 180, 22), new Vector2(168, 46));
            cancel.onClick.AddListener(win.CancelCreate);

            var create = ModernUiTheme.CreateIconButton(panel, "Create", ThaiUiText.Get("Create"), ModernUiIcons.Check,
                ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor);
            ModernUiTheme.Place((RectTransform)create.transform, new Vector2(1, 0),
                new Vector2(-Margin, 22), new Vector2(168, 46));
            create.onClick.AddListener(win.SubmitCreate);
            win.SaveButton = create;
        }

        private static void Label(RectTransform card, string text, ref float y)
        {
            var label = ModernUiTheme.CreateText(card, $"{text}Label", ThaiUiText.Get(text), ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)label.transform, new Vector2(0, 1),
                new Vector2(14, y), new Vector2(200, 20));
            y -= 22f;
        }
    }
}
