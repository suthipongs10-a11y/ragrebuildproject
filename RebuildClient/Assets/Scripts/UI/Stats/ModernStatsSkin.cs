using System.Collections.Generic;
using Assets.Scripts.PlayerControl;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Stats
{
    /// <summary>
    /// Rebuilds the stats window into the clean card theme. The StatsWindow logic is
    /// untouched: this constructs new rows and points the window's public lists
    /// (BaseStatText, AddStatText, StatPointCostText, AttributeText and the buttons)
    /// at the new pieces, then wires the buttons to the window's own methods.
    /// </summary>
    public class ModernStatsSkin : MonoBehaviour
    {
        private const float WindowWidth = 460f;
        private const float WindowHeight = 704f;
        private const float Margin = 20f;
        private const float TopOffset = 116f;
        private const float RowHeight = 46f;
        private const float RowSpacing = 8f;

        private static readonly string[] StatNames = { "STR", "AGI", "VIT", "INT", "DEX", "LUK" };
        private static readonly string[] AttributeNames = { "Atk", "Matk", "Hit", "Critical", "Def", "Mdef", "Flee", "Aspd" };

        private static Sprite[] StatIcons => new[]
        {
            ModernUiIcons.Sword, ModernUiIcons.Bolt, ModernUiIcons.Heart,
            ModernUiIcons.Spark, ModernUiIcons.Target, ModernUiIcons.Star
        };

        private static Sprite[] AttributeIcons => new[]
        {
            ModernUiIcons.Sword, ModernUiIcons.Spark, ModernUiIcons.Target, ModernUiIcons.Star,
            ModernUiIcons.Shield, ModernUiIcons.Shield, ModernUiIcons.Bolt, ModernUiIcons.Bolt
        };

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernStatsSkin>() != null)
                return;

            var host = new GameObject("ModernStatsSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernStatsSkin>();
        }

        private void Update()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.StatusWindow == null)
                return;

            if (ModernUiTheme.IsSkinned(ui.StatusWindow.gameObject))
                return;

            ApplySkin(ui.StatusWindow);
        }

        private void ApplySkin(StatsWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            root.sizeDelta = new Vector2(WindowWidth, WindowHeight);

            ModernUiTheme.ApplyWindowChrome(win);

            //this window lives in the scene rather than a prefab and may carry no image
            //of its own, or one left clear, so the backdrop is added when there is
            //nothing there to paint
            var ownImage = win.GetComponent<Image>();
            if (ownImage == null || ownImage.color.a <= 0.1f)
            {
                var backdrop = ModernUiTheme.CreateCard(root, "ModernSkinBackdrop", ModernUiTheme.WindowColor);
                ModernUiTheme.Stretch(backdrop, 0, 0, 0, 0);
                backdrop.SetSiblingIndex(0);
                backdrop.GetComponent<Image>().raycastTarget = true;
            }

            var panel = ModernUiTheme.CreateRect("ModernSkinPanel", root);
            ModernUiTheme.Stretch(panel, 0, 0, 0, 0);

            //the original chrome goes entirely, the header built below replaces it
            for (var i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                if (child == panel || child.name == "ModernSkinBackdrop")
                    continue;
                child.gameObject.SetActive(false);
            }

            ModernUiTheme.CreateTitleBar(win, "Stats", "Character sheet", ModernUiIcons.Person);
            ModernUiTheme.AttachShadow(root);

            var hint = ModernUiTheme.CreateText(panel, "Hint", "Hold shift to add ten points at a time",
                ModernUiTheme.SizeLabel, ModernUiTheme.HintColor, TextAlignmentOptions.Left);
            ModernUiTheme.Place((RectTransform)hint.transform, new Vector2(0, 1), new Vector2(Margin, -86), new Vector2(WindowWidth - Margin * 2, 22));

            //points remaining, the number the whole window revolves around
            var pointsCard = ModernUiTheme.CreateCard(panel, "PointsCard", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Place(pointsCard, new Vector2(0, 1), new Vector2(Margin, -TopOffset), new Vector2(WindowWidth - Margin * 2, 46));

            var pointsIcon = ModernUiTheme.CreateIcon(pointsCard, ModernUiIcons.Spark, ModernUiTheme.AccentColor, 20);
            ModernUiTheme.Place(pointsIcon.rectTransform, new Vector2(0, 0.5f), new Vector2(14, 0), new Vector2(20, 20));

            var pointsLabel = ModernUiTheme.CreateText(pointsCard, "Label", "Points Available", ModernUiTheme.SizeBody,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
            ModernUiTheme.Stretch((RectTransform)pointsLabel.transform, 44, 2, -120, -2);

            var pointsValue = ModernUiTheme.CreateText(pointsCard, "Value", "0", 22,
                ModernUiTheme.AccentColor, TextAlignmentOptions.Right, FontStyles.Bold);
            ModernUiTheme.Stretch((RectTransform)pointsValue.transform, 14, 2, -14, -2);

            var baseTexts = new List<TextMeshProUGUI>();
            var addTexts = new List<TextMeshProUGUI>();
            var costTexts = new List<TextMeshProUGUI>();
            var plusButtons = new List<Button>();
            var minusButtons = new List<Button>();

            var statsTop = TopOffset + 46 + 12;
            var statIcons = StatIcons;
            for (var i = 0; i < 6; i++)
            {
                var row = ModernUiTheme.CreateCard(panel, $"Stat{i}", ModernUiTheme.CardColor);
                ModernUiTheme.Place(row, new Vector2(0, 1), new Vector2(Margin, -statsTop - i * (RowHeight + RowSpacing)),
                    new Vector2(WindowWidth - Margin * 2, RowHeight));

                var icon = ModernUiTheme.CreateIcon(row, statIcons[i], ModernUiTheme.AccentColor, 20);
                ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(12, 0), new Vector2(20, 20));

                var statLabel = ModernUiTheme.CreateText(row, "Name", StatNames[i], ModernUiTheme.SizeLabel,
                    ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)statLabel.transform, new Vector2(0, 0.5f), new Vector2(42, 0), new Vector2(52, 24));

                var baseValue = ModernUiTheme.CreateText(row, "Base", "1", ModernUiTheme.SizeValue,
                    ModernUiTheme.NameColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)baseValue.transform, new Vector2(0, 0.5f), new Vector2(96, 0), new Vector2(46, 28));

                var bonusValue = ModernUiTheme.CreateText(row, "Bonus", "", ModernUiTheme.SizeLabel,
                    ModernUiTheme.PositiveColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)bonusValue.transform, new Vector2(0, 0.5f), new Vector2(144, 0), new Vector2(56, 24));

                var costValue = ModernUiTheme.CreateText(row, "Cost", "", ModernUiTheme.SizeSmall,
                    ModernUiTheme.MutedColor, TextAlignmentOptions.Right);
                ModernUiTheme.Place((RectTransform)costValue.transform, new Vector2(1, 0.5f), new Vector2(-96, 0), new Vector2(56, 22));

                var minus = ModernUiTheme.CreateButton(row, "Minus", "", ModernUiTheme.CardDeepColor,
                    ModernUiTheme.NameColor);
                ModernUiTheme.Place((RectTransform)minus.transform, new Vector2(1, 0.5f), new Vector2(-52, 0), new Vector2(34, 34));
                ModernUiTheme.CreateIcon((RectTransform)minus.transform, ModernUiIcons.Minus, ModernUiTheme.NameColor, 14);

                var plus = ModernUiTheme.CreateButton(row, "Plus", "", ModernUiTheme.AccentColor,
                    ModernUiTheme.AccentTextColor);
                ModernUiTheme.Place((RectTransform)plus.transform, new Vector2(1, 0.5f), new Vector2(-10, 0), new Vector2(34, 34));
                ModernUiTheme.CreateIcon((RectTransform)plus.transform, ModernUiIcons.Plus, ModernUiTheme.AccentTextColor, 14);

                var statIndex = i;
                plus.onClick.AddListener(() => win.AddStat(statIndex));
                minus.onClick.AddListener(() => win.SubStat(statIndex));

                baseTexts.Add(baseValue);
                addTexts.Add(bonusValue);
                costTexts.Add(costValue);
                plusButtons.Add(plus);
                minusButtons.Add(minus);
            }

            //derived attributes, two columns of label and value pairs
            var attrTop = statsTop + 6 * (RowHeight + RowSpacing) + 6;
            var attrCard = ModernUiTheme.CreateCard(panel, "Attributes", ModernUiTheme.CardColor);
            ModernUiTheme.Place(attrCard, new Vector2(0, 1), new Vector2(Margin, -attrTop),
                new Vector2(WindowWidth - Margin * 2, 126));

            var attrTexts = new List<TextMeshProUGUI>();
            var attrIcons = AttributeIcons;
            var halfWidth = (WindowWidth - Margin * 2) / 2f;
            for (var i = 0; i < 8; i++)
            {
                var column = i % 2;
                var rowIndex = i / 2;
                var x = 14 + column * halfWidth;
                var y = -8 - rowIndex * 28;

                var icon = ModernUiTheme.CreateIcon(attrCard, attrIcons[i], ModernUiTheme.IconMutedColor, 15);
                ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 1), new Vector2(x, y - 4), new Vector2(15, 15));

                var label = ModernUiTheme.CreateText(attrCard, $"AttrLabel{i}", AttributeNames[i],
                    ModernUiTheme.SizeLabel, ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
                ModernUiTheme.Place((RectTransform)label.transform, new Vector2(0, 1), new Vector2(x + 21, y), new Vector2(70, 24));

                var value = ModernUiTheme.CreateText(attrCard, $"AttrValue{i}", "", ModernUiTheme.SizeBody,
                    ModernUiTheme.NameColor, TextAlignmentOptions.Right, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)value.transform, new Vector2(0, 1), new Vector2(x + 87, y), new Vector2(halfWidth - 117, 24));

                attrTexts.Add(value);
            }

            //the ninth attribute slot is the points display the logic writes into
            attrTexts.Add(pointsValue);

            var buttonWidth = (WindowWidth - Margin * 2 - 10) / 2f;

            var reset = ModernUiTheme.CreateIconButton(panel, "Reset", "Reset", ModernUiIcons.Refresh,
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor);
            ModernUiTheme.Place((RectTransform)reset.transform, new Vector2(0, 0), new Vector2(Margin, 18),
                new Vector2(buttonWidth, 44));

            var apply = ModernUiTheme.CreateIconButton(panel, "Apply", "Apply", ModernUiIcons.Check,
                ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor);
            ModernUiTheme.Place((RectTransform)apply.transform, new Vector2(1, 0), new Vector2(-Margin, 18),
                new Vector2(buttonWidth, 44));

            reset.onClick.AddListener(win.ResetStatChanges);
            apply.onClick.AddListener(win.SaveChanges);

            win.BaseStatText = baseTexts;
            win.AddStatText = addTexts;
            win.StatPointCostText = costTexts;
            win.AttributeText = attrTexts;
            win.IncreaseStatButtons = plusButtons;
            win.DecreaseStatButtons = minusButtons;
            win.ResetButton = reset;
            win.ApplyButton = apply;

            if (PlayerState.Instance != null)
            {
                try { win.UpdateCharacterStats(); }
                catch (System.Exception e) { Debug.LogWarning($"[ModernStatsSkin] Initial refresh skipped: {e.Message}"); }
            }

            Debug.Log("[ModernStatsSkin] Rebuilt the stats window.");
        }
    }
}
