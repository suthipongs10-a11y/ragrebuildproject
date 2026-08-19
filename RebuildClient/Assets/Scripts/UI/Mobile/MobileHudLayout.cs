using System.Collections.Generic;
using Assets.Scripts.UI.Hud;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Mobile
{
    /// <summary>
    /// Rearranges the heads-up display for a screen that is taller than it is wide.
    ///
    /// The three pieces the game puts along the top were each placed for a desktop window,
    /// and on a phone they land on top of one another: the readout takes the top left
    /// quarter, the minimap sits over its right edge, and the hotbar - ten slots in a row -
    /// runs off the side of the screen entirely. Between them they cover the part of the
    /// world the player is standing in.
    ///
    /// So: the readout in the top left corner and the minimap in the top right, both scaled
    /// to whatever the screen can actually give them side by side, and the hotbar turned on
    /// its side down the left edge under the readout. What is left is the middle of the
    /// screen, which is where the game is.
    ///
    /// Nothing here is a prefab change. Every position is worked out from what the elements
    /// measure at the moment it runs, so it does not need to know what the scene contains,
    /// and it is applied again whenever the screen changes shape - which on a phone is every
    /// time it is turned over.
    /// </summary>
    public class MobileHudLayout : MonoBehaviour
    {
        /// <summary>How far anything sits from the edge of the screen.</summary>
        private const float Margin = 8f;

        /// <summary>Between the readout and the hotbar under it.</summary>
        private const float Gap = 6f;

        /// <summary>
        /// The share of the width the readout may take before the minimap gets the rest.
        /// It carries seven lines of text and degrades worse than a picture does.
        /// </summary>
        private const float ReadoutShare = 0.56f;

        /// <summary>
        /// The most of the screen's height the hotbar column may run down, measured from the
        /// top. Below that are the thumb controls, and a hotbar reaching into them would be
        /// two things under one finger.
        /// </summary>
        private const float HotbarHeightShare = 0.52f;

        private const float SlotGap = 2f;
        private const float ApplyInterval = 1f;

        /// <summary>
        /// The most of the screen's width the hotbar may take, however many columns it needs.
        ///
        /// Past this it stops being a bar at the edge of the screen and starts being a wall
        /// in front of the game, so beyond it the slots are shrunk instead of wrapped again.
        /// </summary>
        private const float HotbarWidthShare = 0.34f;

        /// <summary>
        /// The most columns the hotbar wraps into.
        ///
        /// Wrapping is what keeps a slot big enough to hit, but only up to a point: past two
        /// columns it stops being a bar down the edge and becomes a keypad over the game,
        /// and on a short screen the wrapping runs away - ten columns of slots shrunk to the
        /// floor to fit the width, which is the same unhittable bar by another route.
        /// Beyond this the column runs a little below its band instead.
        /// </summary>
        private const int HotbarMaxColumns = 2;

        /// <summary>
        /// The smallest a slot may be drawn, as a fraction of the prefab.
        ///
        /// The prefab is already a reasonable target for a fingertip; anything much under
        /// this is one you hit four times out of five, which is worse than no slot at all.
        /// It used to be four tenths, and ten slots forced into one column hit that floor
        /// every time: the skills were on the bar at twenty pixels a side, which reads from
        /// arm's length as an empty bar.
        ///
        /// On a short screen this means the column runs a little past the band it was given
        /// rather than shrinking to fit it. That is the better of the two: a slot that
        /// reaches into the thumb controls is occasionally the wrong hit, and a slot too
        /// small to aim at is always one.
        /// </summary>
        private const float MinSlotScale = 0.8f;

        private readonly Vector3[] corners = new Vector3[4];

        private float applyTimer;
        private bool reportedOnce;

        //reused rather than allocated on every layout pass, which runs on a timer forever
        private readonly List<RectTransform> slots = new List<RectTransform>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<MobileHudLayout>() != null)
                return;

            var host = new GameObject("MobileHudLayout");
            DontDestroyOnLoad(host);
            host.AddComponent<MobileHudLayout>();
        }

        private void Update()
        {
            applyTimer -= Time.deltaTime;
            if (applyTimer > 0f)
                return;
            applyTimer = ApplyInterval;

            var ui = UiManager.Instance;
            if (ui == null || !ui.IsCanvasVisible)
                return;

            //Asked every time rather than once at startup: a browser window can be dragged
            //from wide to tall without the page reloading, and a phone can be turned over.
            //
            //The slots are told either way, not only when it turns out to be a phone, so a
            //window dragged back to landscape gets its double click and its key labels back.
            var wants = MobileMode.IsActive;
            SetSlotsTouchable(ui.SkillHotbar, wants);

            if (!wants)
                return;

            var canvas = CanvasRect();
            if (canvas == null)
                return;

            var bounds = canvas.rect;
            var readoutHeight = LayoutTopRow(canvas, bounds, out var readoutPending);

            //The readout is laid out by a vertical group with a size fitter, so until a layout
            //pass has run on it its rect is zero tall. Putting the hotbar under a height of
            //nothing would put it under the readout; better to leave it where it is for a
            //second and place it once there is a real number to place it against.
            if (readoutPending)
                return;

            LayoutHotbar(canvas, bounds, readoutHeight);
            Report(bounds, readoutHeight);
        }

        /// <summary>The rect everything is placed against, which is the canvas, not a parent.</summary>
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
        /// The readout on the left and the minimap on the right, scaled so the two of them
        /// fit across the screen with a gap rather than overlapping.
        /// </summary>
        /// <returns>How tall the readout ended up, so the hotbar knows where to start.</returns>
        private float LayoutTopRow(RectTransform canvas, Rect bounds, out bool pending)
        {
            pending = false;

            var readout = FindFirstObjectByType<CharacterDetailBox>(FindObjectsInactive.Include);
            var readoutRect = readout != null ? readout.transform as RectTransform : null;

            var minimap = MinimapController.Instance;
            var minimapRect = minimap != null ? minimap.transform as RectTransform : null;

            //three margins: outside the left, between the two, outside the right
            var available = bounds.width - Margin * 3f;
            var readoutHeight = 0f;

            if (readoutRect != null)
            {
                var natural = readoutRect.rect.size;
                if (natural.x < 1f || natural.y < 1f)
                {
                    //nothing has laid it out yet, so there is no size to scale
                    pending = true;
                    return 0f;
                }

                //Never scaled up: on a tablet the desktop size is already right, and blowing
                //it up would take back the room this is here to free.
                //
                //And no floor under it either. There was one, to stop the text going too
                //small to read, and it was the one thing that could make these two overlap:
                //on a narrow screen a floor is a refusal to fit, and two panels drawn over
                //each other are less readable than either of them small. Taking its share of
                //what is there and no more is what makes the fit provable.
                var scale = Mathf.Min(available * ReadoutShare / natural.x, 1f);

                readoutRect.localScale = Vector3.one * scale;
                PinToCorner(canvas, readoutRect, new Vector2(0, 1));

                //measured rather than multiplied out, because the chain of parents between
                //this and the canvas may carry a scale of its own and the hotbar is placed in
                //the canvas's units
                var size = MeasuredSize(canvas, readoutRect);
                readoutHeight = size.y;
                available -= size.x;
            }

            if (minimapRect != null)
            {
                //whatever the readout did not take, and no more, so the two meet at most
                var natural = minimapRect.rect.size;
                var scale = natural.x > 1f ? Mathf.Min(available / natural.x, 1f) : 1f;

                minimapRect.localScale = Vector3.one * scale;
                PinToCorner(canvas, minimapRect, new Vector2(1, 1));
            }

            return readoutHeight;
        }

        /// <summary>How big a rect actually is on screen, in the canvas's own units.</summary>
        private Vector2 MeasuredSize(RectTransform canvas, RectTransform rect)
        {
            rect.GetWorldCorners(corners);
            var bottomLeft = (Vector2)canvas.InverseTransformPoint(corners[0]);
            var topRight = (Vector2)canvas.InverseTransformPoint(corners[2]);
            return new Vector2(Mathf.Abs(topRight.x - bottomLeft.x), Mathf.Abs(topRight.y - bottomLeft.y));
        }

        /// <summary>
        /// Turns the hotbar on its side and stands it against the left edge.
        ///
        /// The bar is three rows of ten laid out by nested layout groups, with the second and
        /// third rows switched off until somebody drags the corner. Those groups are switched
        /// off and the slots placed by hand instead, which is what makes a row into a column;
        /// a layout group cannot be turned ninety degrees, only replaced, and replacing a
        /// component the prefab wired up is a worse trade than placing thirty rects.
        /// </summary>
        private void LayoutHotbar(RectTransform canvas, Rect bounds, float readoutHeight)
        {
            var hotbar = UiManager.Instance != null ? UiManager.Instance.SkillHotbar : null;
            if (hotbar == null || hotbar.SkillBarContainer == null)
                return;

            var container = hotbar.SkillBarContainer as RectTransform;
            if (container == null)
                return;

            DisableLayoutGroups(hotbar.transform);

            //The handle resizes the bar by adding rows, which is a shape this layout does not
            //have and a target the size of a slot in the middle of the column.
            if (hotbar.ResizeHandle != null && hotbar.ResizeHandle.gameObject.activeSelf)
                hotbar.ResizeHandle.gameObject.SetActive(false);

            var slot = FirstSlotSize(container);
            if (slot.x <= 1f || slot.y <= 1f)
                return;

            //Every slot that is actually on screen, in bar order, whichever row it lives in.
            //Gathered into one list first because the wrapping below runs across rows: which
            //row a slot was built into says nothing about where it should be drawn once the
            //bar is a column.
            slots.Clear();
            foreach (RectTransform row in container)
            {
                if (!row.gameObject.activeSelf)
                    continue;

                foreach (RectTransform entry in row)
                {
                    if (entry.gameObject.activeSelf)
                        slots.Add(entry);
                }

                //the row is only a holder now: every slot is placed against the container's
                //top left corner, so all the row has to do is sit there itself
                Place(row, new Vector2(0, 1), Vector2.zero, Vector2.zero);
            }

            if (slots.Count == 0)
                return;

            //How many fit above the thumb controls at the size the prefab draws them, with
            //the rest wrapping into a column beside. The bar used to be squeezed into one
            //column whatever its length, so ten slots never fit and it was drawn at four
            //tenths instead - which is the whole reason it looked empty.
            var band = bounds.height * HotbarHeightShare - readoutHeight - Gap - Margin;
            var perColumn = Mathf.Clamp(Mathf.FloorToInt((band + SlotGap) / (slot.y + SlotGap)),
                1, slots.Count);
            var columns = Mathf.Min(HotbarMaxColumns,
                Mathf.CeilToInt(slots.Count / (float)perColumn));

            //Balanced, so ten slots over two columns are five and five rather than nine and
            //one. Also what puts the leftovers back on screen once the column count is
            //capped: the cap decides how wide, this decides how deep.
            perColumn = Mathf.CeilToInt(slots.Count / (float)columns);

            for (var i = 0; i < slots.Count; i++)
            {
                var column = i / perColumn;
                var row = i % perColumn;

                Place(slots[i], new Vector2(0, 1),
                    new Vector2(column * (slot.x + SlotGap), -row * (slot.y + SlotGap)), slot);
            }

            var width = columns * slot.x + (columns - 1) * SlotGap;
            var height = Mathf.Min(perColumn, slots.Count) * slot.y
                         + (Mathf.Min(perColumn, slots.Count) - 1) * SlotGap;

            var bar = (RectTransform)hotbar.transform;
            Place(container, new Vector2(0, 1), Vector2.zero, new Vector2(width, height));
            Place(bar, new Vector2(0, 1), Vector2.zero, new Vector2(width, height));

            //Drawn at the prefab's own size, which is already a fingertip. Shrunk only if
            //wrapping could not keep it inside the screen - and never past the point where
            //the slots stop being worth aiming at.
            var scale = 1f;
            if (width > bounds.width * HotbarWidthShare)
                scale = bounds.width * HotbarWidthShare / width;
            if (band > 1f && height * scale > band)
                scale = Mathf.Min(scale, band / height);

            bar.localScale = Vector3.one * Mathf.Clamp(scale, MinSlotScale, 1f);

            PinToCorner(canvas, bar, new Vector2(0, 1), readoutHeight + Gap);
        }

        /// <summary>
        /// Whether a slot answers one tap or two, and whether it wears a keyboard hint.
        ///
        /// A slot could only ever be fired by a double click, and its label read "1" or
        /// "Shift 1" - the name of a key on a machine that has none. Between them that is a
        /// hotbar which on a phone reads as decoration: nothing says how to use it and
        /// nothing happens when you try. One tap fires it now, and the label is gone, which
        /// also gives the icon the whole of a slot that is already small.
        ///
        /// Dragging a slot to rearrange it still works: a drag cancels the click before it
        /// is ever sent, so the two gestures cannot both fire.
        ///
        /// Applied every pass rather than once, because the bar rebuilds its rows when the
        /// player changes character and the new slots would come back untouched.
        /// </summary>
        private static void SetSlotsTouchable(SkillHotbar hotbar, bool touch)
        {
            if (hotbar == null)
                return;

            foreach (var entry in hotbar.GetComponentsInChildren<SkillHotbarEntry>(true))
            {
                if (entry.DragItem != null)
                    entry.DragItem.ActivateOnSingleClick = touch;

                if (entry.HotkeyText != null && entry.HotkeyText.gameObject.activeSelf == touch)
                    entry.HotkeyText.gameObject.SetActive(!touch);

                //An empty slot has no draggable to click - it is switched off the moment the
                //slot is cleared - so without this there is nothing on a phone that can put
                //anything into one.
                var tap = entry.GetComponent<HotbarSlotTap>();
                if (touch && tap == null)
                {
                    tap = entry.gameObject.AddComponent<HotbarSlotTap>();
                    tap.Entry = entry;
                }
                else if (!touch && tap != null)
                    Destroy(tap);
            }
        }

        /// <summary>The size of the first slot found, which every other one shares.</summary>
        private static Vector2 FirstSlotSize(RectTransform container)
        {
            foreach (RectTransform row in container)
            {
                foreach (RectTransform entry in row)
                {
                    var size = entry.rect.size;
                    if (size.x > 1f && size.y > 1f)
                        return size;
                }
            }

            return Vector2.zero;
        }

        /// <summary>
        /// Switches off every layout group under the hotbar, once.
        ///
        /// A group left running would put the slots back where it wanted them on the next
        /// layout pass, and it would win, because it runs after this does.
        /// </summary>
        private static void DisableLayoutGroups(Transform root)
        {
            foreach (var group in root.GetComponentsInChildren<LayoutGroup>(true))
            {
                if (group.enabled)
                    group.enabled = false;
            }

            foreach (var fitter in root.GetComponentsInChildren<ContentSizeFitter>(true))
            {
                if (fitter.enabled)
                    fitter.enabled = false;
            }
        }

        private static void Place(RectTransform rect, Vector2 corner, Vector2 position, Vector2 size)
        {
            rect.anchorMin = corner;
            rect.anchorMax = corner;
            rect.pivot = corner;
            rect.sizeDelta = size;
            rect.anchoredPosition = position;
        }

        /// <summary>
        /// Puts one rect in one corner of the screen, by measurement rather than by trusting
        /// its parent to be the screen.
        ///
        /// These elements hang off whatever the scene hung them off, which is not necessarily
        /// a full width rect, and anchoring to a corner of the wrong parent puts a thing in a
        /// corner of something the player cannot see. So it is anchored, then measured against
        /// the canvas, then moved by the difference - which is right whatever the parent turns
        /// out to be, and stays right when the window is resized.
        /// </summary>
        private void PinToCorner(RectTransform canvas, RectTransform rect, Vector2 corner, float inset = 0f)
        {
            rect.anchorMin = corner;
            rect.anchorMax = corner;
            rect.pivot = corner;

            rect.GetWorldCorners(corners);
            //corners[1] is the top left of the rect, corners[2] the top right
            var topLeft = (Vector2)canvas.InverseTransformPoint(corners[1]);
            var topRight = (Vector2)canvas.InverseTransformPoint(corners[2]);

            var bounds = canvas.rect;
            var wantedX = corner.x < 0.5f ? bounds.xMin + Margin : bounds.xMax - Margin;
            var wantedY = bounds.yMax - Margin - inset;

            var haveX = corner.x < 0.5f ? topLeft.x : topRight.x;
            var shift = new Vector2(wantedX - haveX, wantedY - topLeft.y);

            if (shift.sqrMagnitude < 0.01f)
                return;

            //the shift was worked out in the canvas's space; anchoredPosition is in the
            //parent's, and the two are only the same number while the scales match
            var parent = rect.parent as RectTransform;
            var k = parent != null && Mathf.Abs(parent.lossyScale.x) > 0.0001f
                ? canvas.lossyScale.x / parent.lossyScale.x
                : 1f;

            rect.anchoredPosition += shift * k;
        }

        /// <summary>
        /// Says once what the layout was actually given to work with.
        ///
        /// A phone has no console. From a screenshot a readout that is too wide looks the same
        /// as a canvas reported in different units than the one being looked at, and the same
        /// as this never having run at all.
        /// </summary>
        private void Report(Rect bounds, float readoutHeight)
        {
            if (reportedOnce)
                return;
            reportedOnce = true;

            Debug.Log($"[MobileHudLayout] screen {Screen.width}x{Screen.height}, "
                      + $"canvas {bounds.width:0}x{bounds.height:0}, "
                      + $"readout {readoutHeight:0} tall, "
                      + $"hotbar band {bounds.height * HotbarHeightShare - readoutHeight - Gap - Margin:0}.");
        }
    }
}
