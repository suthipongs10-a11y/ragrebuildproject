using Assets.Scripts.UI.Inventory;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// Applies the shared white card theme to the inventory and skill windows.
    /// These two windows keep their original layout and logic, the skin only
    /// retints their chrome, tabs and text so they match the rebuilt equipment
    /// and stats windows. Item and skill entries spawn from template objects,
    /// so restyling the template once is enough to cover every future entry.
    /// </summary>
    public class ModernPanelSkins : MonoBehaviour
    {
        private class SkinMarker : MonoBehaviour { }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (FindFirstObjectByType<ModernPanelSkins>() != null)
                return;

            var host = new GameObject("ModernPanelSkins");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernPanelSkins>();
        }

        private void Update()
        {
            var ui = UiManager.Instance;
            if (ui == null)
                return;

            if (ui.InventoryWindow != null && ui.InventoryWindow.GetComponent<SkinMarker>() == null)
                SkinInventory(ui.InventoryWindow);

            if (ui.SkillManager != null && ui.SkillManager.GetComponent<SkinMarker>() == null)
                SkinSkills(ui.SkillManager);
        }

        private static void SkinInventory(PlayerInventoryWindow win)
        {
            win.gameObject.AddComponent<SkinMarker>();

            ModernUiTheme.ApplyWindowChrome(win);

            if (win.WeightText != null)
                win.WeightText.color = ModernUiTheme.NameColor;

            StyleTabButtons(win.UiTabButtons);

            //the scroll area behind the item grid becomes a soft gray card
            if (win.ViewBoxTransform != null)
            {
                var viewImage = win.ViewBoxTransform.GetComponent<Image>();
                if (viewImage != null)
                {
                    viewImage.sprite = ModernUiTheme.RoundedSprite;
                    viewImage.type = Image.Type.Sliced;
                    viewImage.color = ModernUiTheme.CardDeepColor;
                }
            }

            //item counts spawn from this template, darken them once and every
            //future entry inherits it. Existing entries get the same treatment.
            if (win.ItemEntryPrefab != null)
                ModernUiTheme.RecolorLightTexts(win.ItemEntryPrefab.transform);
            if (win.ItemBoxRoot != null)
                ModernUiTheme.RecolorLightTexts(win.ItemBoxRoot);

            ModernUiTheme.RecolorLightTexts(win.transform);

            Debug.Log("[ModernPanelSkins] Retinted the inventory window.");
        }

        private static void SkinSkills(SkillWindow win)
        {
            win.gameObject.AddComponent<SkinMarker>();

            ModernUiTheme.ApplyWindowChrome(win);

            if (win.PointsText != null)
            {
                win.PointsText.color = ModernUiTheme.NameColor;
                win.PointsText.fontStyle = FontStyles.Bold;
            }

            if (win.Tabs != null)
                StyleTabButtons(win.Tabs.ToArray());

            //the hover tooltip becomes a white card with dark text
            if (win.TooltipBox != null)
            {
                var tipImage = win.TooltipBox.GetComponent<Image>();
                if (tipImage != null)
                {
                    tipImage.sprite = ModernUiTheme.RoundedSprite;
                    tipImage.type = Image.Type.Sliced;
                    tipImage.color = ModernUiTheme.WindowColor;
                }
            }

            if (win.TooltipText != null)
                win.TooltipText.color = ModernUiTheme.NameColor;

            //skill rows are cloned from this template
            if (win.TemplateObject != null)
                ModernUiTheme.RecolorLightTexts(win.TemplateObject.transform);

            ModernUiTheme.RecolorLightTexts(win.transform);

            Debug.Log("[ModernPanelSkins] Retinted the skill window.");
        }

        private static void StyleTabButtons(Button[] tabs)
        {
            if (tabs == null)
                return;

            foreach (var tab in tabs)
            {
                if (tab == null)
                    continue;

                var image = tab.GetComponent<Image>();
                if (image != null)
                {
                    image.sprite = ModernUiTheme.RoundedSprite;
                    image.type = Image.Type.Sliced;
                    image.color = ModernUiTheme.CardColor;
                }

                foreach (var label in tab.GetComponentsInChildren<TextMeshProUGUI>(true))
                    label.color = ModernUiTheme.NameColor;
            }
        }
    }
}
