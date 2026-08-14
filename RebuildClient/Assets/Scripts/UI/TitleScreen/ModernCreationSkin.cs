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

        private static readonly string[] StatNames = { "STR", "AGI", "VIT", "INT", "DEX", "LUK" };

        private float searchTimer;
        private CharacterCreatorWindow creator;
        private TextMeshProUGUI hairStyleLabel;
        private int shownHairStyle = -1;

        private class SkinMarker : MonoBehaviour { }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernCreationSkin>() != null)
                return;

            var host = new GameObject("ModernCreationSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernCreationSkin>();
        }

        private void Update()
        {
            //the style number is the one readout the window doesn't expose a field for,
            //so it is polled off the public hairStyle value instead
            if (creator != null && hairStyleLabel != null && creator.hairStyle != shownHairStyle)
            {
                shownHairStyle = creator.hairStyle;
                hairStyleLabel.text = $"Style {shownHairStyle + 1:00}";
            }

            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            if (creator != null)
                return;

            var found = FindFirstObjectByType<CharacterCreatorWindow>(FindObjectsInactive.Include);
            if (found == null || found.GetComponent<SkinMarker>() != null)
                return;

            ApplySkin(found);
        }

        private void ApplySkin(CharacterCreatorWindow win)
        {
            win.gameObject.AddComponent<SkinMarker>();
            creator = win;

            if (win.Pane == null)
                return;

            var pane = (RectTransform)win.Pane.transform;
            pane.sizeDelta = new Vector2(PaneWidth, PaneHeight);

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

            var title = ModernUiTheme.CreateText(panel, "Title", "Create Character", 22,
                ModernUiTheme.TitleColor, TextAlignmentOptions.Left, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)title.transform, new Vector2(0, 1),
                new Vector2(Margin, -22), new Vector2(400, 30));

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
                    placeholder.text = "Character name";
                }
            }
            y -= 48f;

            Label(card, "Gender", ref y);
            var maleButton = ModernUiTheme.CreateButton(card, "Male", "Male", ModernUiTheme.AccentColor,
                ModernUiTheme.AccentTextColor, 14);
            ModernUiTheme.Place((RectTransform)maleButton.transform, new Vector2(0, 1),
                new Vector2(14, y), new Vector2((LeftWidth - 34) / 2f, 34));

            var femaleButton = ModernUiTheme.CreateButton(card, "Female", "Female", ModernUiTheme.CardDeepColor,
                ModernUiTheme.NameColor, 14);
            ModernUiTheme.Place((RectTransform)femaleButton.transform, new Vector2(0, 1),
                new Vector2(20 + (LeftWidth - 34) / 2f, y), new Vector2((LeftWidth - 34) / 2f, 34));

            maleButton.onClick.AddListener(() => win.ChangeGender(true));
            femaleButton.onClick.AddListener(() => win.ChangeGender(false));
            win.GenderButtons = new[] { maleButton, femaleButton };
            //the window marks the active choice by making that button uninteractable
            maleButton.interactable = false;
            y -= 44f;

            Label(card, "Hair style", ref y);
            var prev = ModernUiTheme.CreateButton(card, "HairPrev", "<", ModernUiTheme.CardDeepColor,
                ModernUiTheme.NameColor, 16);
            ModernUiTheme.Place((RectTransform)prev.transform, new Vector2(0, 1), new Vector2(14, y), new Vector2(40, 34));
            prev.onClick.AddListener(() => win.ChangeHair(false));

            hairStyleLabel = ModernUiTheme.CreateText(card, "HairStyle", "Style 01", 15,
                ModernUiTheme.NameColor, TextAlignmentOptions.Center, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)hairStyleLabel.transform, new Vector2(0, 1),
                new Vector2(58, y), new Vector2(LeftWidth - 116, 34));

            var next = ModernUiTheme.CreateButton(card, "HairNext", ">", ModernUiTheme.CardDeepColor,
                ModernUiTheme.NameColor, 16);
            ModernUiTheme.Place((RectTransform)next.transform, new Vector2(0, 1),
                new Vector2(LeftWidth - 54, y), new Vector2(40, 34));
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

            var left = ModernUiTheme.CreateButton(card, "TurnLeft", "<", ModernUiTheme.CardColor,
                ModernUiTheme.NameColor, 16);
            ModernUiTheme.Place((RectTransform)left.transform, new Vector2(0, 0),
                new Vector2(28, 16), new Vector2(90, 34));
            left.onClick.AddListener(() => win.TurnCharacter(true));

            var right = ModernUiTheme.CreateButton(card, "TurnRight", ">", ModernUiTheme.CardColor,
                ModernUiTheme.NameColor, 16);
            ModernUiTheme.Place((RectTransform)right.transform, new Vector2(1, 0),
                new Vector2(-28, 16), new Vector2(90, 34));
            right.onClick.AddListener(() => win.TurnCharacter(false));
        }

        private void BuildRightColumn(CharacterCreatorWindow win, RectTransform panel, string[] startingStats,
            string startingPoints)
        {
            var x = Margin + LeftWidth + ColumnGap + CenterWidth + ColumnGap;

            var card = ModernUiTheme.CreateCard(panel, "StatsCard", ModernUiTheme.CardColor);
            ModernUiTheme.Place(card, new Vector2(0, 1), new Vector2(x, -TopOffset), new Vector2(RightWidth, 404));

            var pointsLabel = ModernUiTheme.CreateText(card, "PointsLabel", "Points remaining", 13,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            ModernUiTheme.Place((RectTransform)pointsLabel.transform, new Vector2(0, 1),
                new Vector2(14, -12), new Vector2(180, 22));

            var points = ModernUiTheme.CreateText(card, "Points", startingPoints, 20,
                ModernUiTheme.AccentColor, TextAlignmentOptions.Right, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)points.transform, new Vector2(1, 1),
                new Vector2(-14, -8), new Vector2(70, 28));
            win.StatsRemainingText = points;

            var texts = new TextMeshProUGUI[6];
            var ups = new Button[6];
            var downs = new Button[6];

            for (var i = 0; i < 6; i++)
            {
                var row = ModernUiTheme.CreateCard(card, $"Stat{i}", ModernUiTheme.CardDeepColor);
                ModernUiTheme.Place(row, new Vector2(0, 1),
                    new Vector2(14, -46 - i * (StatRowHeight + StatRowGap)),
                    new Vector2(RightWidth - 28, StatRowHeight));

                var name = ModernUiTheme.CreateText(row, "Name", StatNames[i], 14,
                    ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)name.transform, new Vector2(0, 0.5f),
                    new Vector2(12, 0), new Vector2(56, 22));
                name.rectTransform.pivot = new Vector2(0, 0.5f);

                var down = ModernUiTheme.CreateButton(row, "Minus", "-", ModernUiTheme.CardColor,
                    ModernUiTheme.NameColor, 16);
                ModernUiTheme.Place((RectTransform)down.transform, new Vector2(1, 0.5f),
                    new Vector2(-98, 0), new Vector2(30, 30));
                ((RectTransform)down.transform).pivot = new Vector2(1, 0.5f);

                var value = ModernUiTheme.CreateText(row, "Value", startingStats[i] ?? "5", 17,
                    ModernUiTheme.NameColor, TextAlignmentOptions.Center, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)value.transform, new Vector2(1, 0.5f),
                    new Vector2(-52, 0), new Vector2(46, 26));
                value.rectTransform.pivot = new Vector2(1, 0.5f);

                var up = ModernUiTheme.CreateButton(row, "Plus", "+", ModernUiTheme.AccentColor,
                    ModernUiTheme.AccentTextColor, 16);
                ModernUiTheme.Place((RectTransform)up.transform, new Vector2(1, 0.5f),
                    new Vector2(-12, 0), new Vector2(30, 30));
                ((RectTransform)up.transform).pivot = new Vector2(1, 0.5f);

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
            var cancel = ModernUiTheme.CreateButton(panel, "Cancel", "Cancel", ModernUiTheme.CardDeepColor,
                ModernUiTheme.NameColor, 15);
            ModernUiTheme.Place((RectTransform)cancel.transform, new Vector2(1, 0),
                new Vector2(-Margin - 180, 22), new Vector2(160, 44));
            cancel.onClick.AddListener(win.CancelCreate);

            var create = ModernUiTheme.CreateButton(panel, "Create", "Create", ModernUiTheme.AccentColor,
                ModernUiTheme.AccentTextColor, 15);
            ModernUiTheme.Place((RectTransform)create.transform, new Vector2(1, 0),
                new Vector2(-Margin, 22), new Vector2(160, 44));
            create.onClick.AddListener(win.SubmitCreate);
            win.SaveButton = create;
        }

        private static void Label(RectTransform card, string text, ref float y)
        {
            var label = ModernUiTheme.CreateText(card, $"{text}Label", text, 12,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            ModernUiTheme.Place((RectTransform)label.transform, new Vector2(0, 1),
                new Vector2(14, y), new Vector2(200, 18));
            y -= 20f;
        }
    }
}
