using Assets.Scripts.PlayerControl;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Inventory
{
    /// <summary>
    /// Rebuilds the equipment window's visuals into a clean card layout at runtime.
    /// The EquipmentWindow component and all of its logic stay untouched: this only
    /// constructs a new hierarchy and points the window's public references
    /// (EquipEntries, AmmoType, CartInfo) at the new pieces, so refreshes, drags,
    /// right-click descriptions and double-click unequips all keep working.
    /// </summary>
    public class ModernEquipSkin : MonoBehaviour
    {
        private const float WindowWidth = 880f;
        private const float WindowHeight = 648f;
        private const float CardWidth = 254f;
        private const float CardHeight = 58f;
        private const float CardSpacing = 12f;
        private const float Margin = 24f;
        private const float TopOffset = 124f; //below the header and the hint line

        //this skin predates the shared theme, its colours now come from there
        private static Color WindowColor => ModernUiTheme.WindowColor;
        private static Color CardColor => ModernUiTheme.CardColor;
        private static Color CenterColor => ModernUiTheme.CardDeepColor;
        private static Color LabelColor => ModernUiTheme.LabelColor;
        private static Color NameColor => ModernUiTheme.NameColor;
        private static Color EmptyColor => ModernUiTheme.MutedColor;
        private static Color HintColor => ModernUiTheme.HintColor;

        private static readonly string[] SlotLabels =
        {
            "Upper Head", "Mid Head", "Lower Head", "Armor", "Right Hand",
            "Left Hand", "Garment", "Footgear", "Accessory", "Accessory"
        };

        //left column then right column, matching the layout of the design
        private static readonly int[] LeftSlots = { 0, 2, 4, 6, 8 };
        private static readonly int[] RightSlots = { 1, 3, 5, 7, 9 };

        //shown in an empty slot so the window still reads at a glance with nothing worn
        private static Sprite[] SlotIcons => new[]
        {
            ModernUiIcons.Helmet, ModernUiIcons.Glasses, ModernUiIcons.Mask, ModernUiIcons.Armor,
            ModernUiIcons.Sword, ModernUiIcons.Shield, ModernUiIcons.Cape, ModernUiIcons.Boot,
            ModernUiIcons.Ring, ModernUiIcons.Ring
        };

        private Sprite roundedSprite;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernEquipSkin>() != null)
                return;

            var host = new GameObject("ModernEquipSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernEquipSkin>();
        }

        private void Update()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.EquipmentWindow == null)
                return;

            if (ModernUiTheme.IsSkinned(ui.EquipmentWindow.gameObject))
                return;

            ApplySkin(ui.EquipmentWindow);
        }

        private void ApplySkin(EquipmentWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            if (roundedSprite == null)
                roundedSprite = ModernUiTheme.RoundedSprite;

            var root = (RectTransform)win.transform;
            root.sizeDelta = new Vector2(WindowWidth, WindowHeight);

            //the window's own image becomes the clean white backdrop
            var rootImage = win.GetComponent<Image>();
            if (rootImage != null)
            {
                rootImage.sprite = roundedSprite;
                rootImage.type = Image.Type.Sliced;
                rootImage.color = WindowColor;
            }

            //the character preview moves into the new center card before the old content goes away
            var preview = win.PlayerSprite != null ? win.PlayerSprite.transform : null;

            var panel = CreateRect("ModernSkinPanel", root);
            Stretch(panel, 0, 0, 0, 0);

            var centerCard = CreateCard(panel, "CenterCard");
            if (preview != null)
            {
                preview.SetParent(centerCard, false);
                var previewRect = preview as RectTransform;
                if (previewRect != null)
                {
                    //the sprite's pivot sits well above its feet, so anchoring it to the
                    //middle of the card left the character floating with a gap underneath
                    previewRect.anchorMin = new Vector2(0.5f, 0.5f);
                    previewRect.anchorMax = new Vector2(0.5f, 0.5f);
                    previewRect.anchoredPosition = new Vector2(0, -78);
                }
                preview.gameObject.SetActive(true);
            }

            //the whole original layout goes, including its chrome, and the themed header
            //below takes over moving and closing the window
            for (var i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                if (child == panel)
                    continue;
                child.gameObject.SetActive(false);
            }

            ModernUiTheme.CreateTitleBar(win, ThaiUiText.Get("Equipment"), ThaiUiText.Get("Worn gear"), ModernUiIcons.Armor);
            ModernUiTheme.AttachShadow(root);

            CreateText(panel, "Hint", ThaiUiText.Get("Double-click a slot to unequip  ·  Right-click an item for details"),
                ModernUiTheme.SizeLabel, HintColor, TextAlignmentOptions.Left, FontStyles.Normal,
                new Vector2(Margin, -92), new Vector2(WindowWidth - Margin * 2, 22), new Vector2(0, 1));

            //center card sits between the two slot columns
            centerCard.anchorMin = new Vector2(0.5f, 1);
            centerCard.anchorMax = new Vector2(0.5f, 1);
            centerCard.pivot = new Vector2(0.5f, 1);
            centerCard.sizeDelta = new Vector2(WindowWidth - (CardWidth + Margin + 16) * 2, CardHeight * 5 + CardSpacing * 4 - 60);
            centerCard.anchoredPosition = new Vector2(0, -TopOffset);

            var entries = new EquipWindowEntry[10];
            BuildColumn(panel, LeftSlots, entries, leftSide: true);
            BuildColumn(panel, RightSlots, entries, leftSide: false);

            //ammo card under the character preview
            var ammoCard = CreateCard(panel, "AmmoCard");
            ammoCard.anchorMin = new Vector2(0.5f, 1);
            ammoCard.anchorMax = new Vector2(0.5f, 1);
            ammoCard.pivot = new Vector2(0.5f, 1);
            ammoCard.sizeDelta = new Vector2(centerCard.sizeDelta.x, 46);
            ammoCard.anchoredPosition = new Vector2(0, -TopOffset - centerCard.sizeDelta.y - CardSpacing);

            var ammoText = CreateText(ammoCard, "AmmoText", "", ModernUiTheme.SizeLabel, NameColor,
                TextAlignmentOptions.Center, FontStyles.Normal, Vector2.zero, Vector2.zero, null);
            Stretch((RectTransform)ammoText.transform, 8, 4, -8, -4);

            var cartText = CreateText(panel, "CartText", "", ModernUiTheme.SizeBody, NameColor,
                TextAlignmentOptions.Left, FontStyles.Normal, new Vector2(Margin, 18), new Vector2(400, 26), new Vector2(0, 0));

            win.EquipEntries = entries;
            win.AmmoType = ammoText;
            win.CartInfo = cartText;

            if (PlayerState.Instance != null && PlayerState.Instance.Inventory != null)
            {
                try { win.RefreshEquipmentWindow(); }
                catch (System.Exception e) { Debug.LogWarning($"[ModernEquipSkin] Initial refresh skipped: {e.Message}"); }
            }

            Debug.Log("[ModernEquipSkin] Rebuilt the equipment window.");
        }

        private void BuildColumn(RectTransform panel, int[] slots, EquipWindowEntry[] entries, bool leftSide)
        {
            for (var row = 0; row < slots.Length; row++)
            {
                var slotIndex = slots[row];
                var card = CreateCard(panel, $"Slot{slotIndex}");

                var corner = leftSide ? new Vector2(0, 1) : new Vector2(1, 1);
                card.anchorMin = corner;
                card.anchorMax = corner;
                card.pivot = corner;
                card.sizeDelta = new Vector2(CardWidth, CardHeight);
                var x = leftSide ? Margin : -Margin;
                card.anchoredPosition = new Vector2(x, -TopOffset - row * (CardHeight + CardSpacing));

                entries[slotIndex] = BuildSlotContents(card, slotIndex);
            }
        }

        private EquipWindowEntry BuildSlotContents(RectTransform card, int slotIndex)
        {
            //the small always-visible label naming the slot
            CreateText(card, "SlotLabel", ThaiUiText.Get(SlotLabels[slotIndex]), ModernUiTheme.SizeSmall, LabelColor,
                TextAlignmentOptions.TopLeft, FontStyles.Bold,
                new Vector2(64, -6), new Vector2(CardWidth - 74, 18), new Vector2(0, 1));

            //shown while the slot is empty
            var background = CreateRect("Background", card);
            Stretch(background, 0, 0, 0, 0);

            //the slot's own icon stands in for the missing item, which is what makes an
            //empty column still read as a set of equipment slots rather than blank rows
            var slotIcon = ModernUiTheme.CreateIcon(background, SlotIcons[slotIndex], EmptyColor, 26);
            ModernUiTheme.Place(slotIcon.rectTransform, new Vector2(0, 0.5f), new Vector2(19, 0), new Vector2(26, 26));

            var emptyText = CreateText(background, "EmptyText", ThaiUiText.Get("Empty"), ModernUiTheme.SizeLabel, EmptyColor,
                TextAlignmentOptions.Right, FontStyles.Normal, Vector2.zero, Vector2.zero, null);
            Stretch((RectTransform)emptyText.transform, 12, 4, -16, -4);

            //the item icon, RefreshSlot resizes it to the sprite's own dimensions
            var iconObject = new GameObject("Icon", typeof(Image));
            iconObject.transform.SetParent(card, false);
            var icon = iconObject.GetComponent<Image>();
            icon.raycastTarget = false;
            icon.preserveAspect = true;
            var iconRect = iconObject.GetComponent<RectTransform>();
            iconRect.anchorMin = new Vector2(0, 0.5f);
            iconRect.anchorMax = new Vector2(0, 0.5f);
            iconRect.anchoredPosition = new Vector2(32, 0);

            var itemName = CreateText(card, "ItemName", "", ModernUiTheme.SizeBody, NameColor,
                TextAlignmentOptions.Left, FontStyles.Bold, Vector2.zero, Vector2.zero, null);
            var nameRect = (RectTransform)itemName.transform;
            Stretch(nameRect, 64, 4, -10, -22);
            itemName.overflowMode = TextOverflowModes.Ellipsis;

            var entry = card.gameObject.AddComponent<EquipWindowEntry>();
            entry.Background = background.gameObject;
            entry.Image = icon;
            entry.ItemName = itemName;
            entry.Slot = (RebuildSharedData.Enum.EquipSlot)slotIndex;
            entry.ClearSlot();
            return entry;
        }

        //---------------------------------------------------------------- helpers

        private RectTransform CreateRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        private RectTransform CreateCard(Transform parent, string name)
        {
            var go = new GameObject(name, typeof(Image));
            go.transform.SetParent(parent, false);
            var image = go.GetComponent<Image>();
            image.sprite = roundedSprite;
            image.type = Image.Type.Sliced;
            image.color = name == "CenterCard" ? CenterColor : CardColor;
            return (RectTransform)go.transform;
        }

        private TextMeshProUGUI CreateText(Transform parent, string name, string content, float size, Color color,
            TextAlignmentOptions alignment, FontStyles style, Vector2 position, Vector2 rectSize, Vector2? corner)
        {
            var go = new GameObject(name, typeof(TextMeshProUGUI));
            go.transform.SetParent(parent, false);

            var text = go.GetComponent<TextMeshProUGUI>();
            if (ModernUiTheme.ThemeFont != null)
            {
                text.font = ModernUiTheme.ThemeFont;
                var material = ModernUiTheme.CrispMaterial;
                if (material != null)
                    text.fontSharedMaterial = material;
            }

            text.text = content;
            text.fontSize = size;
            text.color = color;
            text.alignment = alignment;
            text.fontStyle = style;
            text.raycastTarget = false;
            text.extraPadding = true;

            if (corner.HasValue)
            {
                var rect = (RectTransform)go.transform;
                rect.anchorMin = corner.Value;
                rect.anchorMax = corner.Value;
                rect.pivot = corner.Value;
                rect.sizeDelta = rectSize;
                rect.anchoredPosition = position;
            }

            return text;
        }

        private static void Stretch(RectTransform rect, float left, float bottom, float right, float top)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(left, bottom);
            rect.offsetMax = new Vector2(right, top);
        }

    }
}
