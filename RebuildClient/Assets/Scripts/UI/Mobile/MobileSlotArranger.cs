using System.Collections.Generic;
using System.Globalization;
using Assets.Scripts.UI.ConfigWindow;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Assets.Scripts.UI.Mobile
{
    /// <summary>
    /// Letting the player put their skill buttons wherever their thumbs actually are.
    /// </summary>
    /// <remarks>
    /// The phone layout stands the hotbar in a column down the left edge, which is a
    /// reasonable guess and wrong for at least half of everybody: it lands under the touch
    /// controls on a small screen, and it is nowhere near a thumb on a large one. There is
    /// no arrangement that is right for every hand, so this stops guessing and hands the
    /// question over.
    ///
    /// It is a mode rather than a gesture, because a slot already answers both of the
    /// gestures a finger has. A tap fires the skill and a drag carries it to another slot -
    /// there is no third thing a finger can do to a square, so moving that square has to be
    /// a state the screen is in rather than a way of touching it. While the mode is on the
    /// draggable inside each slot is switched off, which is what lets the drag reach the
    /// slot itself; when it goes off, the slots go back to being buttons.
    ///
    /// Positions are kept per slot and only for slots that were moved, so anything left
    /// alone still follows the automatic layout and still moves when the screen is turned.
    /// </remarks>
    public static class MobileSlotArranger
    {
        /// <summary>Whether slots are being moved rather than used.</summary>
        public static bool ArrangeMode { get; private set; }

        /// <summary>Raised when the mode turns on or off, so the layout can re-apply itself.</summary>
        public static System.Action ModeChanged;

        private static readonly Dictionary<int, Vector2> positions = new Dictionary<int, Vector2>();
        private static bool loaded;

        public static void ToggleArrangeMode()
        {
            ArrangeMode = !ArrangeMode;
            ModeChanged?.Invoke();
        }

        public static bool TryGetPosition(int id, out Vector2 position)
        {
            Load();
            return positions.TryGetValue(id, out position);
        }

        public static void SetPosition(int id, Vector2 position)
        {
            Load();
            positions[id] = position;
            Save();
        }

        /// <summary>Puts every slot back in the column, which is the way out of a mess.</summary>
        public static void ResetAll()
        {
            Load();
            if (positions.Count == 0)
                return;

            positions.Clear();
            Save();
            ModeChanged?.Invoke();
        }

        public static bool HasAny
        {
            get
            {
                Load();
                return positions.Count > 0;
            }
        }

        // =====================================================================
        // Kept between sessions

        private static void Load()
        {
            if (loaded)
                return;

            GameConfig.InitializeIfNecessary();
            loaded = true;

            var saved = GameConfig.Data != null ? GameConfig.Data.MobileSkillSlotPositions : null;
            if (saved == null)
                return;

            foreach (var line in saved)
            {
                if (string.IsNullOrEmpty(line))
                    continue;

                //"id:x:y", and anything that is not that is a line from an older build or a
                //hand edited file - dropped rather than argued with, which costs one button
                //its place instead of costing the bar its layout
                var parts = line.Split(':');
                if (parts.Length != 3)
                    continue;

                if (!int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var id)
                    || !float.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var x)
                    || !float.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out var y))
                    continue;

                positions[id] = new Vector2(x, y);
            }
        }

        private static void Save()
        {
            GameConfig.InitializeIfNecessary();
            if (GameConfig.Data == null)
                return;

            var saved = GameConfig.Data.MobileSkillSlotPositions;
            if (saved == null)
            {
                saved = new List<string>();
                GameConfig.Data.MobileSkillSlotPositions = saved;
            }

            saved.Clear();
            foreach (var pair in positions)
            {
                saved.Add(string.Format(CultureInfo.InvariantCulture, "{0}:{1:0.##}:{2:0.##}",
                    pair.Key, pair.Value.x, pair.Value.y));
            }

            GameConfig.SaveConfig();
        }
    }

    /// <summary>
    /// What the phone layout is currently showing, for the parts of it that fold away.
    /// </summary>
    /// <remarks>
    /// Only the readout so far. It is the biggest thing on the screen and the one whose
    /// numbers matter least from moment to moment, so it is the one worth being able to
    /// put away - and worth having stay away, which is why it is remembered rather than
    /// reset every time the game starts.
    /// </remarks>
    public static class MobileHudVisibility
    {
        public static bool ReadoutHidden
        {
            get
            {
                GameConfig.InitializeIfNecessary();
                return GameConfig.Data != null && GameConfig.Data.MobileHideReadout;
            }
            set
            {
                GameConfig.InitializeIfNecessary();
                if (GameConfig.Data == null || GameConfig.Data.MobileHideReadout == value)
                    return;

                GameConfig.Data.MobileHideReadout = value;
                GameConfig.SaveConfig();
            }
        }

        public static void ToggleReadout() => ReadoutHidden = !ReadoutHidden;
    }

    /// <summary>
    /// Moves one hotbar slot while the arrange mode is on.
    /// </summary>
    /// <remarks>
    /// Hung on the slot itself rather than on the draggable inside it, so it only ever sees
    /// the drags that draggable did not take - which, while the mode is on, is all of them.
    /// The position is worked out by asking where the finger is inside the slot's own parent
    /// rather than by adding up deltas, because a delta is in screen pixels and the parent
    /// may be scaled: over a long drag the two drift apart and the button ends up somewhere
    /// the finger never was.
    /// </remarks>
    public class MobileSlotDragger : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        public SkillHotbarEntry Entry;

        private Vector2 grabOffset;

        public void OnBeginDrag(PointerEventData eventData)
        {
            if (!MobileSlotArranger.ArrangeMode)
                return;

            var rect = (RectTransform)transform;
            var parent = rect.parent as RectTransform;
            if (parent == null)
                return;

            //where inside the slot the finger landed, so the button does not jump its own
            //width the moment it is picked up
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(parent, eventData.position,
                    eventData.pressEventCamera, out var local))
                grabOffset = rect.anchoredPosition - local;

            rect.SetAsLastSibling();
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (!MobileSlotArranger.ArrangeMode)
                return;

            var rect = (RectTransform)transform;
            var parent = rect.parent as RectTransform;
            if (parent == null)
                return;

            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(parent, eventData.position,
                    eventData.pressEventCamera, out var local))
                rect.anchoredPosition = local + grabOffset;
        }

        public void OnEndDrag(PointerEventData eventData)
        {
            if (!MobileSlotArranger.ArrangeMode || Entry == null)
                return;

            MobileSlotArranger.SetPosition(Entry.Id, ((RectTransform)transform).anchoredPosition);
        }
    }
}
