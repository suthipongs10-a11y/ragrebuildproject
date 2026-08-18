using System.Collections.Generic;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using Assets.Scripts.UI.ConfigWindow;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Mobile
{
    /// <summary>
    /// Fills a hotbar slot by tapping, for a screen with no room to drag across.
    ///
    /// Dragging a skill onto a slot is a mouse gesture: press here, travel there, release,
    /// with the thing you are carrying drawn under the pointer the whole way. On a phone the
    /// pointer is the finger, so it covers both ends of that journey, and the window you
    /// dragged from is usually over the place you are dragging to.
    ///
    /// So the same job is done in two taps that cannot miss: choose the slot, choose what
    /// goes in it. Nothing is carried anywhere.
    ///
    /// It writes through the same call the saved layout is restored with, so a slot filled
    /// here is a slot filled any other way - it saves, it counts down, it fires.
    /// </summary>
    public class HotbarPickerWindow : WindowBase
    {
        private const float Width = 460f;
        private const float Height = 460f;
        private const float Pad = 8f;

        private const float RowHeight = 34f;
        private const float RowGap = 3f;
        private const float HeadingHeight = 22f;
        private const float IconSize = 26f;

        /// <summary>
        /// The slots offered. One column of ten is what the phone layout puts on screen; the
        /// further two columns only exist for somebody who has dragged the bar open on a
        /// desktop, and they are not reachable from here.
        /// </summary>
        private const int SlotCount = 10;

        private const float StripHeight = 34f;
        private const float StripGap = 3f;

        private static readonly Color ChosenColor = new Color(0.165f, 0.435f, 0.780f);

        private static HotbarPickerWindow instance;

        private RectTransform body;
        private RectTransform strip;
        private TextMeshProUGUI subtitle;

        private readonly List<GameObject> rows = new List<GameObject>();
        private readonly List<Button> slotButtons = new List<Button>();

        private int chosenSlot;

        /// <summary>Opens the picker with one slot already chosen.</summary>
        public static void Open(int slotId)
        {
            if (instance == null)
                instance = Build();

            if (instance == null)
                return;

            instance.chosenSlot = Mathf.Clamp(slotId, 0, SlotCount - 1);
            instance.gameObject.SetActive(true);
            instance.Redraw();
            instance.MoveToTop();
        }

        private static HotbarPickerWindow Build()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            //assembled inactive so nothing runs against a half built window
            var host = new GameObject("HotbarPickerWindow", typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var window = host.AddComponent<HotbarPickerWindow>();
            window.CanCloseWithEscape = true;
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(Width, Height);

            ModernUiTheme.CreateTitleBar(window, "ใส่แถบลัด", "", ModernUiIcons.Grid);
            ModernUiTheme.AttachShadow(rect);

            window.subtitle = ModernUiTheme.CreateText(rect, "Chosen", "", ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Right);
            window.subtitle.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(window.subtitle.rectTransform, new Vector2(1, 1),
                new Vector2(-52f, -30f), new Vector2(200f, 20f));

            window.BuildSlotStrip(rect);

            var top = ModernUiTheme.TitleBarHeight + StripHeight + StripGap;
            var viewport = ModernUiTheme.CreateCard(rect, "Viewport", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Stretch(viewport, Pad, Pad, -Pad, -top);
            viewport.gameObject.AddComponent<RectMask2D>();

            window.body = ModernUiTheme.CreateRect("Choices", viewport);
            window.body.anchorMin = new Vector2(0, 1);
            window.body.anchorMax = new Vector2(1, 1);
            window.body.pivot = new Vector2(0.5f, 1);
            window.body.offsetMin = Vector2.zero;
            window.body.offsetMax = Vector2.zero;

            var scroll = host.AddComponent<ScrollRect>();
            scroll.viewport = viewport;
            scroll.content = window.body;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 32f;

            host.SetActive(true);
            return window;
        }

        /// <summary>
        /// The row of ten numbered buttons that says which slot is being filled.
        ///
        /// Built once and only recoloured afterwards, so tapping along it does not throw
        /// away the thing being tapped.
        /// </summary>
        private void BuildSlotStrip(RectTransform root)
        {
            strip = ModernUiTheme.CreateRect("Slots", root);
            ModernUiTheme.Place(strip, new Vector2(0, 1),
                new Vector2(Pad, -ModernUiTheme.TitleBarHeight),
                new Vector2(Width - Pad * 2f, StripHeight));

            var usable = Width - Pad * 2f;
            var cell = (usable - StripGap * (SlotCount - 1)) / SlotCount;

            for (var i = 0; i < SlotCount; i++)
            {
                var button = ModernUiTheme.CreateButton(strip, "Slot" + i, (i + 1).ToString(),
                    ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)button.transform, new Vector2(0, 1),
                    new Vector2(i * (cell + StripGap), 0f), new Vector2(cell, StripHeight));

                var slot = i;
                button.onClick.AddListener(() =>
                {
                    chosenSlot = slot;
                    Redraw();
                });

                slotButtons.Add(button);
            }
        }

        private void PaintStrip()
        {
            for (var i = 0; i < slotButtons.Count; i++)
            {
                var chosen = i == chosenSlot;

                var image = slotButtons[i].GetComponent<Image>();
                if (image != null)
                    image.color = chosen ? ChosenColor : ModernUiTheme.CardColor;

                var label = slotButtons[i].GetComponentInChildren<TextMeshProUGUI>();
                if (label != null)
                {
                    label.color = chosen ? ModernUiTheme.LightInkColor : ModernUiTheme.NameColor;
                    label.fontStyle = chosen ? FontStyles.Bold : FontStyles.Normal;
                }
            }
        }

        private static SkillHotbar Hotbar() =>
            UiManager.Instance != null ? UiManager.Instance.SkillHotbar : null;

        /// <summary>
        /// Drops a skill into the first free slot, and says which one it went to.
        ///
        /// This is the route that cannot miss. Dragging asks the finger to travel from the
        /// skill window to a slot the skill window is usually sitting on top of, and the
        /// picker asks the player to know that an empty square is a button. Tapping the skill
        /// you want asks nothing: it is already the thing under the finger.
        ///
        /// Full bar and nothing else to do about it, so it says so rather than quietly
        /// replacing something that was put there on purpose.
        /// </summary>
        public static void PutOnBar(int skillId, int level, SkillWindowEntry source)
        {
            var hotbar = Hotbar();
            var data = ClientDataLoader.Instance;
            if (hotbar == null || data == null)
                return;

            var skill = data.GetSkillData((CharacterSkill)skillId);
            if (skill == null)
                return;

            if (skill.Target == SkillTarget.Passive)
            {
                Say("สกิลนี้เป็นพาสซีฟ ใส่แถบลัดไม่ได้");
                return;
            }

            var sprite = data.GetIconAtlasSprite(skill.Icon);
            if (sprite == null)
                return;

            for (var i = 0; i < SlotCount; i++)
            {
                var entry = hotbar.GetEntryById(i);
                if (entry == null || entry.DragItem == null)
                    continue;

                //already on the bar, so putting it on again would only take a second slot
                if (entry.DragItem.Type == DragItemType.Skill && entry.DragItem.ItemId == skillId)
                {
                    Say($"{skill.Name} อยู่ในช่องที่ {i + 1} แล้ว");
                    return;
                }
            }

            for (var i = 0; i < SlotCount; i++)
            {
                var entry = hotbar.GetEntryById(i);
                if (entry == null || entry.DragItem == null || entry.DragItem.Type != DragItemType.None)
                    continue;

                entry.DragItem.gameObject.SetActive(true);
                entry.DragItem.Assign(DragItemType.Skill, sprite, skillId,
                    skill.AdjustableLevel ? level : 0);
                entry.DragItem.Origin = ItemDragOrigin.HotBar;
                entry.DragItem.OriginId = i;

                hotbar.UpdateItemCounts();
                SaveHotbar();

                if (source != null)
                    source.HighlightSkillBox();

                Say($"ใส่ {skill.Name} ในช่องที่ {i + 1} แล้ว");
                return;
            }

            Say("แถบลัดเต็มแล้ว — แตะช่องที่ต้องการเปลี่ยนเพื่อเลือกใหม่");
        }

        private static void Say(string text)
        {
            var camera = CameraFollower.Instance;
            if (camera != null)
                camera.AppendChatText($"<color=#77FF77>{text}</color>");
        }

        private void Redraw()
        {
            ClearRows();
            PaintStrip();

            subtitle.text = $"ช่องที่ {chosenSlot + 1}";

            var y = -RowGap;

            BuildClearRow(ref y);

            var data = ClientDataLoader.Instance;
            var state = PlayerState.Instance;

            if (data == null || state == null)
            {
                body.sizeDelta = new Vector2(0, -y);
                return;
            }

            y -= RowGap;
            BuildHeading("สกิล", y);
            y -= HeadingHeight;

            var anySkill = false;
            foreach (var known in state.KnownSkills)
            {
                if (known.Value <= 0)
                    continue;

                var skill = data.GetSkillData(known.Key);
                if (skill == null)
                    continue;

                //a passive has nothing to fire, so a slot holding one would be a slot that
                //does nothing when it is tapped
                if (skill.Target == SkillTarget.Passive)
                    continue;

                anySkill = true;
                var level = known.Value;
                var id = (int)known.Key;
                var adjustable = skill.AdjustableLevel;

                BuildChoice(data.GetIconAtlasSprite(skill.Icon), skill.Name, $"Lv.{level}", y,
                    () => Assign(DragItemType.Skill, data.GetIconAtlasSprite(skill.Icon), id,
                        adjustable ? level : 0));
                y -= RowHeight + RowGap;
            }

            if (!anySkill)
            {
                BuildNote("ยังไม่มีสกิลที่ใช้ได้", y);
                y -= HeadingHeight;
            }

            y -= RowGap;
            BuildHeading("ไอเทม", y);
            y -= HeadingHeight;

            var anyItem = false;
            if (state.Inventory != null)
            {
                foreach (var pair in state.Inventory.GetInventoryData())
                {
                    var item = pair.Value;
                    if (item.ItemData == null || item.ItemData.ItemClass != ItemClass.Useable)
                        continue;

                    anyItem = true;
                    var sprite = data.GetIconAtlasSprite(item.ItemData.Sprite);
                    var itemId = item.Id;

                    BuildChoice(sprite, item.ItemData.Name, $"x{item.Count}", y,
                        () => Assign(DragItemType.Item, sprite, itemId, 0));
                    y -= RowHeight + RowGap;
                }
            }

            if (!anyItem)
            {
                BuildNote("ไม่มีไอเทมที่ใช้ได้ในกระเป๋า", y);
                y -= HeadingHeight;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        private void BuildClearRow(ref float y)
        {
            var hotbar = Hotbar();
            var entry = hotbar != null ? hotbar.GetEntryById(chosenSlot) : null;
            if (entry == null || entry.DragItem == null || entry.DragItem.Type == DragItemType.None)
                return;

            BuildChoice(null, "ล้างช่องนี้", "", y, () =>
            {
                entry.Clear();
                SaveHotbar();
                Redraw();
            });
            y -= RowHeight + RowGap;
        }

        /// <summary>
        /// Puts one thing in the chosen slot, through the same call the saved layout is
        /// restored with, and writes the bar back out so it is still there next time.
        /// </summary>
        private void Assign(DragItemType type, Sprite sprite, int id, int count)
        {
            var hotbar = Hotbar();
            var entry = hotbar != null ? hotbar.GetEntryById(chosenSlot) : null;
            if (entry == null || entry.DragItem == null || sprite == null)
                return;

            entry.DragItem.gameObject.SetActive(true);
            entry.DragItem.Assign(type, sprite, id, count);
            entry.DragItem.Origin = ItemDragOrigin.HotBar;
            entry.DragItem.OriginId = chosenSlot;

            hotbar.UpdateItemCounts();
            SaveHotbar();
            CloseWindow();
        }

        /// <summary>
        /// Writes the bar out, so a slot filled here is still filled next time.
        ///
        /// SaveConfig already asks the hotbar to serialise itself into the array it keeps for
        /// this character, so there is nothing to hand it - calling it is the whole job.
        /// </summary>
        private static void SaveHotbar() => GameConfig.SaveConfig();

        private void BuildChoice(Sprite icon, string label, string trailing, float y,
            UnityEngine.Events.UnityAction onClick)
        {
            var row = ModernUiTheme.CreateCard(body, "Choice", ModernUiTheme.WindowColor);
            row.anchorMin = new Vector2(0, 1);
            row.anchorMax = new Vector2(1, 1);
            row.pivot = new Vector2(0.5f, 1);
            row.sizeDelta = new Vector2(-RowGap * 2f, RowHeight);
            row.anchoredPosition = new Vector2(0, y);
            rows.Add(row.gameObject);

            var button = row.gameObject.AddComponent<Button>();
            button.targetGraphic = row.GetComponent<Image>();
            button.onClick.AddListener(onClick);

            var textLeft = 12f;
            if (icon != null)
            {
                var image = new GameObject("Icon", typeof(Image));
                image.transform.SetParent(row, false);
                var graphic = image.GetComponent<Image>();
                graphic.sprite = icon;
                graphic.raycastTarget = false;
                graphic.preserveAspect = true;
                ModernUiTheme.Place((RectTransform)image.transform, new Vector2(0, 0.5f),
                    new Vector2(10f, 0f), new Vector2(IconSize, IconSize));
                textLeft = 10f + IconSize + 10f;
            }

            var name = ModernUiTheme.CreateText(row, "Name", label, ModernUiTheme.SizeLabel,
                ModernUiTheme.NameColor, TextAlignmentOptions.Left);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 0.5f),
                new Vector2(textLeft, 0f), new Vector2(Width - textLeft - 100f, RowHeight));

            if (string.IsNullOrEmpty(trailing))
                return;

            var tail = ModernUiTheme.CreateText(row, "Trailing", trailing, ModernUiTheme.SizeSmall,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Right);
            ModernUiTheme.Place(tail.rectTransform, new Vector2(1, 0.5f),
                new Vector2(-12f, 0f), new Vector2(80f, RowHeight));
        }

        private void BuildHeading(string text, float y)
        {
            var label = ModernUiTheme.CreateText(body, "Heading", text, ModernUiTheme.SizeSmall,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
            var rect = label.rectTransform;
            rect.anchorMin = new Vector2(0, 1);
            rect.anchorMax = new Vector2(1, 1);
            rect.pivot = new Vector2(0.5f, 1);
            rect.sizeDelta = new Vector2(-24f, HeadingHeight);
            rect.anchoredPosition = new Vector2(0, y);
            rows.Add(label.gameObject);
        }

        private void BuildNote(string text, float y)
        {
            var label = ModernUiTheme.CreateText(body, "Note", text, ModernUiTheme.SizeLabel,
                ModernUiTheme.MutedColor, TextAlignmentOptions.Left);
            var rect = label.rectTransform;
            rect.anchorMin = new Vector2(0, 1);
            rect.anchorMax = new Vector2(1, 1);
            rect.pivot = new Vector2(0.5f, 1);
            rect.sizeDelta = new Vector2(-24f, HeadingHeight);
            rect.anchoredPosition = new Vector2(0, y);
            rows.Add(label.gameObject);
        }

        private void ClearRows()
        {
            foreach (var row in rows)
            {
                if (row == null)
                    continue;

                //Destroy does not take effect until the end of the frame, so the old rows
                //would be drawn under the new ones for a frame without this.
                row.SetActive(false);
                Destroy(row);
            }

            rows.Clear();
        }
    }
}
