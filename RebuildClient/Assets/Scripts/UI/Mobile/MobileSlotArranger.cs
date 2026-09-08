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

        /// <summary>
        /// Which way a saved position is measured, written into every line.
        /// </summary>
        /// <remarks>
        /// Bumped when the meaning changes, which is the only way a number kept between
        /// sessions can be reinterpreted safely: a stale line is dropped rather than read
        /// as something it never was.
        /// </remarks>
        private const string Version = "2";

        //Every position is an offset from the top left corner of the screen, in canvas
        //units, rather than from the hotbar it came out of. The hotbar is scaled to fit and
        //pinned under a readout that folds away, so a position measured from it means
        //something different every time either of those changes - which is how a button
        //dropped in the middle of the screen ended up above the top of it.
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
        // Measured against the screen

        /// <summary>The canvas everything is placed against, asked for the same way twice.</summary>
        private static RectTransform CanvasRect()
        {
            var follower = CameraFollower.Instance;
            var canvas = follower != null ? follower.UiCanvas : null;
            if (canvas == null)
                return null;

            var root = canvas.rootCanvas != null ? canvas.rootCanvas : canvas;
            return root.transform as RectTransform;
        }

        /// <summary>
        /// How far a rect's top left corner sits from the screen's, in canvas units, with
        /// y counted downward.
        /// </summary>
        public static bool TryReadScreenOffset(RectTransform rect, out Vector2 offset)
        {
            offset = Vector2.zero;

            var canvas = CanvasRect();
            if (canvas == null || rect == null)
                return false;

            var local = (Vector2)canvas.InverseTransformPoint(rect.position);
            var bounds = canvas.rect;
            offset = new Vector2(local.x - bounds.xMin, bounds.yMax - local.y);
            return true;
        }

        /// <summary>Puts a rect back at an offset read by TryReadScreenOffset.</summary>
        public static bool ApplyScreenOffset(RectTransform rect, Vector2 offset)
        {
            var canvas = CanvasRect();
            if (canvas == null || rect == null)
                return false;

            var bounds = canvas.rect;
            rect.position = canvas.TransformPoint(
                new Vector3(bounds.xMin + offset.x, bounds.yMax - offset.y, 0f));
            return true;
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

                //"id:x:y:2", and anything that is not that is dropped rather than argued
                //with, which costs one button its place instead of costing the bar its
                //layout. The trailing 2 is the version: the first build measured a position
                //from the corner of the hotbar, which moves and is scaled, so those numbers
                //mean nothing now and three-part lines are left behind on purpose.
                var parts = line.Split(':');
                if (parts.Length != 4 || parts[3] != Version)
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
                saved.Add(string.Format(CultureInfo.InvariantCulture, "{0}:{1:0.##}:{2:0.##}:{3}",
                    pair.Key, pair.Value.x, pair.Value.y, Version));
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
        /// <summary>
        /// Whether the hotbar column is put away.
        /// </summary>
        /// <remarks>
        /// Only the column. Anything the player dragged out of it stays exactly where they
        /// put it and keeps working, which is the whole point of putting the bar away: the
        /// four skills somebody actually uses end up under their thumbs, and the rest of
        /// the bar is a row of empty squares over the map until it is asked for again.
        /// </remarks>
        public static bool HotbarHidden
        {
            get
            {
                GameConfig.InitializeIfNecessary();
                return GameConfig.Data != null && GameConfig.Data.MobileHideHotbar;
            }
            set
            {
                GameConfig.InitializeIfNecessary();
                if (GameConfig.Data == null || GameConfig.Data.MobileHideHotbar == value)
                    return;

                GameConfig.Data.MobileHideHotbar = value;
                GameConfig.SaveConfig();
            }
        }

        public static void ToggleHotbar() => HotbarHidden = !HotbarHidden;

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
        /// <summary>The slot this drag moves, which is not always the object it lands on.</summary>
        public RectTransform Target;

        public SkillHotbarEntry Entry;

        private Vector2 grabOffset;

        public void OnBeginDrag(PointerEventData eventData)
        {
            if (!MobileSlotArranger.ArrangeMode || Target == null)
                return;

            //where inside the slot the finger landed, so the button does not jump its own
            //width the moment it is picked up
            if (TryPoint(eventData, out var local))
                grabOffset = Target.anchoredPosition - local;

            Target.SetAsLastSibling();
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (!MobileSlotArranger.ArrangeMode || Target == null)
                return;

            if (TryPoint(eventData, out var local))
                Target.anchoredPosition = local + grabOffset;
        }

        public void OnEndDrag(PointerEventData eventData)
        {
            if (!MobileSlotArranger.ArrangeMode || Target == null || Entry == null)
                return;

            //Recorded against the screen rather than against the bar, so the button stays
            //where it was let go of whatever the bar does afterwards.
            if (MobileSlotArranger.TryReadScreenOffset(Target, out var offset))
                MobileSlotArranger.SetPosition(Entry.Id, offset);
        }

        /// <summary>
        /// Where the finger is, in the units the slot's own position is written in.
        /// </summary>
        /// <remarks>
        /// Asked of the parent rather than accumulated from deltas: a delta is in screen
        /// pixels and the parent may be scaled, so over a long drag the two drift apart and
        /// the button ends up somewhere the finger never was.
        /// </remarks>
        private bool TryPoint(PointerEventData eventData, out Vector2 local)
        {
            local = Vector2.zero;
            var parent = Target.parent as RectTransform;
            return parent != null && RectTransformUtility.ScreenPointToLocalPointInRectangle(
                parent, eventData.position, eventData.pressEventCamera, out local);
        }
    }
}
