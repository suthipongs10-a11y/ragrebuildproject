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
        private const float WindowHeight = 692f;
        private const float Margin = 20f;
        private const float TopOffset = 116f;
        private const float RowHeight = 46f;
        private const float RowSpacing = 8f;

        private static readonly string[] StatNames = { "STR", "AGI", "VIT", "INT", "DEX", "LUK" };
        private static readonly string[] AttributeNames = { "Atk", "Matk", "Hit", "Critical", "Def", "Mdef", "Flee", "Aspd" };

        private class SkinMarker : MonoBehaviour { }

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

            if (ui.StatusWindow.GetComponent<SkinMarker>() != null)
                return;

            ApplySkin(ui.StatusWindow);
        }

        private void ApplySkin(StatsWindow win)
        {
            win.gameObject.AddComponent<SkinMarker>();

            var root = (RectTransform)win.transform;
            root.sizeDelta = new Vector2(WindowWidth, WindowHeight);

            ModernUiTheme.ApplyWindowChrome(win);

            //this window lives in the scene rather than a prefab and may carry no image
            //of its own, so the backdrop is added when it is missing
            if (win.GetComponent<Image>() == null)
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

            ModernUiTheme.CreateTitleBar(win, "Stats", "สเตตัส");
            ModernUiTheme.AttachShadow(root);

            var hint = ModernUiTheme.CreateText(panel, "Hint", "Hold shift to add ten points at a time",
                13, ModernUiTheme.HintColor, TextAlignmentOptions.Left);
            ModernUiTheme.Place((RectTransform)hint.transform, new Vector2(0, 1), new Vector2(Margin, -86), new Vector2(WindowWidth - Margin * 2, 20));

            //points remaining, the number the whole window revolves around
            var pointsCard = ModernUiTheme.CreateCard(panel, "PointsCard", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Place(pointsCard, new Vector2(0, 1), new Vector2(Margin, -TopOffset), new Vector2(WindowWidth - Margin * 2, 44));

            var pointsLabel = ModernUiTheme.CreateText(pointsCard, "Label", "Points Available", 14,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            ModernUiTheme.Stretch((RectTransform)pointsLabel.transform, 14, 2, -120, -2);

            var pointsValue = ModernUiTheme.CreateText(pointsCard, "Value", "0", 20,
                ModernUiTheme.NameColor, TextAlignmentOptions.Right, FontStyles.Bold);
            ModernUiTheme.Stretch((RectTransform)pointsValue.transform, 14, 2, -14, -2);

            var baseTexts = new List<TextMeshProUGUI>();
            var addTexts = new List<TextMeshProUGUI>();
            var costTexts = new List<TextMeshProUGUI>();
            var plusButtons = new List<Button>();
            var minusButtons = new List<Button>();

            var statsTop = TopOffset + 44 + 12;
            for (var i = 0; i < 6; i++)
            {
                var row = ModernUiTheme.CreateCard(panel, $"Stat{i}", ModernUiTheme.CardColor);
                ModernUiTheme.Place(row, new Vector2(0, 1), new Vector2(Margin, -statsTop - i * (RowHeight + RowSpacing)),
                    new Vector2(WindowWidth - Margin * 2, RowHeight));

                var statLabel = ModernUiTheme.CreateText(row, "Name", StatNames[i], 14,
                    ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)statLabel.transform, new Vector2(0, 0.5f), new Vector2(14, 0), new Vector2(60, 24));
                statLabel.rectTransform.pivot = new Vector2(0, 0.5f);

                var baseValue = ModernUiTheme.CreateText(row, "Base", "1", 17,
                    ModernUiTheme.NameColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)baseValue.transform, new Vector2(0, 0.5f), new Vector2(70, 0), new Vector2(46, 26));
                baseValue.rectTransform.pivot = new Vector2(0, 0.5f);

                var bonusValue = ModernUiTheme.CreateText(row, "Bonus", "", 14,
                    ModernUiTheme.PositiveColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)bonusValue.transform, new Vector2(0, 0.5f), new Vector2(118, 0), new Vector2(50, 22));
                bonusValue.rectTransform.pivot = new Vector2(0, 0.5f);

                var costValue = ModernUiTheme.CreateText(row, "Cost", "", 12,
                    ModernUiTheme.MutedColor, TextAlignmentOptions.Right);
                ModernUiTheme.Place((RectTransform)costValue.transform, new Vector2(1, 0.5f), new Vector2(-96, 0), new Vector2(50, 20));
                costValue.rectTransform.pivot = new Vector2(1, 0.5f);

                var minus = ModernUiTheme.CreateButton(row, "Minus", "-", ModernUiTheme.CardDeepColor,
                    ModernUiTheme.NameColor, 18);
                ModernUiTheme.Place((RectTransform)minus.transform, new Vector2(1, 0.5f), new Vector2(-52, 0), new Vector2(34, 34));
                ((RectTransform)minus.transform).pivot = new Vector2(1, 0.5f);

                var plus = ModernUiTheme.CreateButton(row, "Plus", "+", ModernUiTheme.AccentColor,
                    ModernUiTheme.AccentTextColor, 18);
                ModernUiTheme.Place((RectTransform)plus.transform, new Vector2(1, 0.5f), new Vector2(-10, 0), new Vector2(34, 34));
                ((RectTransform)plus.transform).pivot = new Vector2(1, 0.5f);

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
                new Vector2(WindowWidth - Margin * 2, 118));

            var attrTexts = new List<TextMeshProUGUI>();
            var halfWidth = (WindowWidth - Margin * 2) / 2f;
            for (var i = 0; i < 8; i++)
            {
                var column = i % 2;
                var rowIndex = i / 2;
                var x = 14 + column * halfWidth;
                var y = -8 - rowIndex * 26;

                var label = ModernUiTheme.CreateText(attrCard, $"AttrLabel{i}", AttributeNames[i], 13,
                    ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
                ModernUiTheme.Place((RectTransform)label.transform, new Vector2(0, 1), new Vector2(x, y), new Vector2(70, 22));

                var value = ModernUiTheme.CreateText(attrCard, $"AttrValue{i}", "", 13,
                    ModernUiTheme.NameColor, TextAlignmentOptions.Right, FontStyles.Bold);
                ModernUiTheme.Place((RectTransform)value.transform, new Vector2(0, 1), new Vector2(x + 66, y), new Vector2(halfWidth - 96, 22));

                attrTexts.Add(value);
            }

            //the ninth attribute slot is the points display the logic writes into
            attrTexts.Add(pointsValue);

            var reset = ModernUiTheme.CreateButton(panel, "Reset", "Reset", ModernUiTheme.CardDeepColor,
                ModernUiTheme.NameColor);
            ModernUiTheme.Place((RectTransform)reset.transform, new Vector2(0, 0), new Vector2(Margin, 18),
                new Vector2((WindowWidth - Margin * 2 - 10) / 2f, 40));

            var apply = ModernUiTheme.CreateButton(panel, "Apply", "Apply", ModernUiTheme.AccentColor,
                ModernUiTheme.AccentTextColor);
            ModernUiTheme.Place((RectTransform)apply.transform, new Vector2(1, 0), new Vector2(-Margin, 18),
                new Vector2((WindowWidth - Margin * 2 - 10) / 2f, 40));

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
