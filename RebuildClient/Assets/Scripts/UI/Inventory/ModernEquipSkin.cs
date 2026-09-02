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
        //two columns of slots and nothing between them. The character used to stand in
        //the middle here; he belongs to the hub window now, where he stays visible while
        //the other tabs are open, so this page is exactly the two columns wide.
        private const float WindowWidth = 572f;
        private const float WindowHeight = 648f;
        private const float CardWidth = 254f;
        private const float CardHeight = 58f;
        private const float CardSpacing = 12f;
        private const float Margin = 24f;
        private const float TopOffset = 124f; //below the header and the hint line

        //this skin predates the shared theme, its colours now come from there
        private static Color WindowColor => ModernUiTheme.WindowColor;
        private static Color CardColor => ModernUiTheme.CardColor;
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
            if (!ModernUiTheme.SkinsEnabled)
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

            //The character preview is deliberately left where it is. CharacterHubWindow
            //takes it when it builds and stands it in a column of its own, so that it is
            //there on the stats and skills tabs too rather than only on this one.
            var panel = CreateRect("ModernSkinPanel", root);
            Stretch(panel, 0, 0, 0, 0);

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

            var entries = new EquipWindowEntry[10];
            BuildColumn(panel, LeftSlots, entries, leftSide: true);
            BuildColumn(panel, RightSlots, entries, leftSide: false);

            //A real slot across the foot of both columns, where the middle used to be.
            //The window this replaced said which ammunition was loaded and gave no way to
            //load any, which left an archer with arrows in the bag and nothing to shoot.
            var ammoText = BuildAmmoSlot(panel);

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

            ModernUiTheme.StyleCloseButtons(win.transform);

            //The window's drop zone is one of the children switched off above, and the drag
            //manager switches it back on for anything equippable. That was not enough on its
            //own: the rebuilt layout is the last child and so draws over everything, and a
            //pointer stops at the topmost graphic, so the zone underneath never saw the drag
            //and nothing could be equipped by dropping it here. An archer felt that first,
            //because dropping a stack of arrows on this window is how ammunition is loaded.
            //Lifted back over the layout and resized to the window it now has to cover; it is
            //only switched on while a drag is in progress, so it is in nobody's way the rest
            //of the time.
            var dropZone = root.Find("EquipmentDropZone") as RectTransform;
            if (dropZone != null)
            {
                Stretch(dropZone, 0, 0, 0, 0);
                dropZone.SetAsLastSibling();
            }

            Debug.Log($"[ModernEquipSkin] Rebuilt the equipment window "
                      + $"(drop zone {(dropZone != null ? "restored" : "MISSING")}).");
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

        /// <summary>
        /// The ammunition slot: an icon, what is loaded, how much of it is left, and a
        /// surface that takes a stack dropped from the bag.
        ///
        /// Returns a label for the window's own AmmoType reference. That reference is not
        /// optional — EquipmentWindow writes to it on every refresh and reads it back on
        /// every click — so it is kept, but it is kept off screen: the line it writes is
        /// English and carries a link for unequipping, and the slot says the same thing in
        /// Thai and unequips on a click anywhere in it.
        /// </summary>
        private TextMeshProUGUI BuildAmmoSlot(RectTransform panel)
        {
            var card = CreateCard(panel, "AmmoCard");
            card.anchorMin = new Vector2(0.5f, 1);
            card.anchorMax = new Vector2(0.5f, 1);
            card.pivot = new Vector2(0.5f, 1);
            card.sizeDelta = new Vector2(WindowWidth - Margin * 2, 58);
            card.anchoredPosition = new Vector2(0,
                -TopOffset - (CardHeight * 5 + CardSpacing * 4) - CardSpacing);

            var image = card.GetComponent<Image>();
            image.raycastTarget = true;

            //sits over the card and is clear until something is dragged across it, the
            //same way the window's own drop zone marks itself
            var highlight = CreateCard(card, "Highlight");
            Stretch(highlight, 0, 0, 0, 0);
            var highlightImage = highlight.GetComponent<Image>();
            highlightImage.color = new Color32(0, 0, 0, 0);
            highlightImage.raycastTarget = false;

            CreateText(card, "AmmoLabel", ThaiUiText.Get("Ammunition"), ModernUiTheme.SizeSmall,
                LabelColor, TextAlignmentOptions.Left, FontStyles.Normal,
                new Vector2(14, -6), new Vector2(200, 16), new Vector2(0, 1));

            var iconRect = CreateRect("AmmoIcon", card);
            iconRect.anchorMin = new Vector2(0, 0.5f);
            iconRect.anchorMax = new Vector2(0, 0.5f);
            iconRect.pivot = new Vector2(0, 0.5f);
            iconRect.sizeDelta = new Vector2(28, 28);
            iconRect.anchoredPosition = new Vector2(14, -6);
            var icon = iconRect.gameObject.AddComponent<Image>();
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            icon.color = new Color32(0, 0, 0, 0);

            var name = CreateText(card, "AmmoName", "", ModernUiTheme.SizeBody, NameColor,
                TextAlignmentOptions.Left, FontStyles.Bold, new Vector2(50, -20),
                new Vector2(300, 24), new Vector2(0, 1));

            var count = CreateText(card, "AmmoCount", "", ModernUiTheme.SizeLabel, LabelColor,
                TextAlignmentOptions.Right, FontStyles.Normal, new Vector2(-14, -20),
                new Vector2(140, 24), new Vector2(1, 1));

            //kept alive for the window, kept out of the way of the slot
            var ammoText = CreateText(card, "AmmoType", "", ModernUiTheme.SizeSmall, NameColor,
                TextAlignmentOptions.Left, FontStyles.Normal, Vector2.zero, new Vector2(1, 1),
                new Vector2(0, 0));
            ammoText.color = new Color(0, 0, 0, 0);

            var slot = card.gameObject.AddComponent<ModernAmmoSlot>();
            slot.Highlight = highlightImage;
            slot.Icon = icon;
            slot.Label = name;
            slot.Count = count;

            return ammoText;
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
            image.color = CardColor;
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
