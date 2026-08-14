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
        private const float WindowHeight = 620f;
        private const float CardWidth = 254f;
        private const float CardHeight = 58f;
        private const float CardSpacing = 12f;
        private const float Margin = 24f;
        private const float TopOffset = 96f; //below the drag bar and the hint line

        private static readonly Color WindowColor = new Color(1f, 1f, 1f, 0.97f);
        private static readonly Color CardColor = new Color(0.949f, 0.957f, 0.973f);
        private static readonly Color CenterColor = new Color(0.933f, 0.942f, 0.960f);
        private static readonly Color TitleColor = new Color(0.078f, 0.094f, 0.125f);
        private static readonly Color LabelColor = new Color(0.541f, 0.573f, 0.639f);
        private static readonly Color NameColor = new Color(0.122f, 0.141f, 0.188f);
        private static readonly Color EmptyColor = new Color(0.765f, 0.788f, 0.831f);
        private static readonly Color HintColor = new Color(0.42f, 0.455f, 0.52f);

        private static readonly string[] SlotLabels =
        {
            "Upper Head", "Mid Head", "Lower Head", "Armor", "Right Hand",
            "Left Hand", "Garment", "Footgear", "Accessory", "Accessory"
        };

        //left column then right column, matching the layout of the design
        private static readonly int[] LeftSlots = { 0, 2, 4, 6, 8 };
        private static readonly int[] RightSlots = { 1, 3, 5, 7, 9 };

        private Sprite roundedSprite;

        private class SkinMarker : MonoBehaviour { }

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

            if (ui.EquipmentWindow.GetComponent<SkinMarker>() != null)
                return;

            ApplySkin(ui.EquipmentWindow);
        }

        private void ApplySkin(EquipmentWindow win)
        {
            win.gameObject.AddComponent<SkinMarker>();

            if (roundedSprite == null)
                roundedSprite = CreateRoundedSprite();

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

            //keep the drag bar alive so moving and closing still work, just recolor it
            Transform dragBar = null;
            for (var i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                var lower = child.name.ToLowerInvariant();
                if (lower.Contains("drag"))
                {
                    dragBar = child;
                    var barImage = child.GetComponent<Image>();
                    if (barImage != null)
                    {
                        barImage.sprite = roundedSprite;
                        barImage.type = Image.Type.Sliced;
                        barImage.color = WindowColor;
                    }
                    foreach (var barText in child.GetComponentsInChildren<TextMeshProUGUI>(true))
                    {
                        barText.color = TitleColor;
                        barText.fontStyle = FontStyles.Bold;
                    }
                    foreach (var barButton in child.GetComponentsInChildren<Button>(true))
                    {
                        var buttonImage = barButton.GetComponent<Image>();
                        if (buttonImage != null)
                            buttonImage.color = HintColor;
                    }
                }
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
                    previewRect.anchorMin = new Vector2(0.5f, 0.5f);
                    previewRect.anchorMax = new Vector2(0.5f, 0.5f);
                    previewRect.anchoredPosition = new Vector2(0, -20);
                }
                preview.gameObject.SetActive(true);
            }

            //everything from the old layout that isn't the drag bar or our panel gets hidden
            for (var i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                if (child == dragBar || child == panel)
                    continue;
                child.gameObject.SetActive(false);
            }

            CreateText(panel, "Hint", "Double-click a slot to unequip  ·  Right-click an item for details",
                13, HintColor, TextAlignmentOptions.Left, FontStyles.Normal,
                new Vector2(Margin, -64), new Vector2(WindowWidth - Margin * 2, 22), new Vector2(0, 1));

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

            var ammoText = CreateText(ammoCard, "AmmoText", "", 13, NameColor, TextAlignmentOptions.Center,
                FontStyles.Normal, Vector2.zero, Vector2.zero, null);
            Stretch((RectTransform)ammoText.transform, 8, 4, -8, -4);

            var cartText = CreateText(panel, "CartText", "", 14, NameColor, TextAlignmentOptions.Left,
                FontStyles.Normal, new Vector2(Margin, 18), new Vector2(400, 24), new Vector2(0, 0));

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
            CreateText(card, "SlotLabel", SlotLabels[slotIndex], 11, LabelColor, TextAlignmentOptions.TopLeft,
                FontStyles.Normal, new Vector2(64, -7), new Vector2(CardWidth - 74, 16), new Vector2(0, 1));

            //shown while the slot is empty
            var background = CreateRect("Background", card);
            Stretch(background, 0, 0, 0, 0);
            var emptyText = CreateText(background, "EmptyText", SlotLabels[slotIndex], 14, EmptyColor,
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

            var itemName = CreateText(card, "ItemName", "", 14, NameColor, TextAlignmentOptions.Left,
                FontStyles.Bold, Vector2.zero, Vector2.zero, null);
            var nameRect = (RectTransform)itemName.transform;
            Stretch(nameRect, 64, 4, -10, -20);
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
            if (TMP_Settings.defaultFontAsset != null)
                text.font = TMP_Settings.defaultFontAsset;
            text.text = content;
            text.fontSize = size;
            text.color = color;
            text.alignment = alignment;
            text.fontStyle = style;
            text.raycastTarget = false;

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

        private static Sprite CreateRoundedSprite()
        {
            const int size = 32;
            const int radius = 10;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);

            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    var inside = true;
                    //check each corner circle, pixels beyond the arc turn transparent
                    if (x < radius && y < radius)
                        inside = InCorner(x, y, radius, radius);
                    else if (x >= size - radius && y < radius)
                        inside = InCorner(x, y, size - radius - 1, radius);
                    else if (x < radius && y >= size - radius)
                        inside = InCorner(x, y, radius, size - radius - 1);
                    else if (x >= size - radius && y >= size - radius)
                        inside = InCorner(x, y, size - radius - 1, size - radius - 1);

                    texture.SetPixel(x, y, inside ? Color.white : Color.clear);
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100,
                0, SpriteMeshType.FullRect, new Vector4(12, 12, 12, 12));
        }

        private static bool InCorner(int x, int y, int cx, int cy)
        {
            var dx = x - cx;
            var dy = y - cy;
            return dx * dx + dy * dy <= 10 * 10;
        }
    }
}
