using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.UI.ConfigWindow;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    /// <summary>
    /// A standing sign over the handful of NPCs that are worth walking to.
    ///
    /// Two things were wrong with every earlier attempt and both are fixed here.
    ///
    /// The first is what it was made of. The sign used to be world-space geometry — sprite
    /// quads and a TextMeshPro mesh hung off the NPC — and the board turned up while the
    /// writing on it never did. Coplanar quads and a text mesh do not agree about who is in
    /// front; sorting order only settles that between renderers the engine has already
    /// decided to draw in the same pass, and a text mesh and a sprite are not that. So the
    /// board painted over its own writing. The client never had this problem with the hover
    /// plate, the cast bar or the chat bubble because none of them are in the world: they
    /// are interface elements on the canvas, moved to wherever the character happens to be
    /// on screen. This is that, the same arithmetic as <see cref="VendTitleBox"/>.
    ///
    /// The second is who got one. A sign over every NPC is a wall of boards in a town and
    /// tells you nothing, which is the opposite of the point. Only the names in
    /// <see cref="SignedNames"/> are signed.
    /// </summary>
    public class NpcNamePlates : MonoBehaviour
    {
        /// <summary>
        /// The NPCs worth a permanent sign, matched loosely against the name.
        ///
        /// Add a line to sign another. Keep it short: the value of a sign is that only a few
        /// things have one.
        /// </summary>
        private static readonly string[] SignedNames =
        {
            "Class Master",
            "Job Master",
            "Kafra",
            "Enchant Scribe",
        };

        /// <summary>
        /// Slow on purpose. It only has to notice NPCs coming into view; the signs move
        /// themselves every frame in between.
        /// </summary>
        private const float SweepInterval = 0.4f;

        /// <summary>Far enough to spot from across a field, near enough not to litter a town.</summary>
        private const float ShowDistance = 26f;

        //Canvas units, before the zoom scaling the whole board gets. The interface is laid
        //out at this size and then scaled, the same as every other overlay in the client.
        private const float FontSize = 25f;
        private const float PadX = 15f;
        private const float PadY = 9f;
        private const float IconSize = 26f;
        private const float IconGap = 9f;
        private const float TailSize = 17f;
        private const float BorderWidth = 3f;

        /// <summary>Clear of the head, and clear of the hover plate when both are up.</summary>
        private const float ExtraHeight = 30f;

        private sealed class Sign
        {
            public ServerControllable Target;

            /// <summary>Sits on the NPC's feet; carries the screen position and the zoom scale.</summary>
            public RectTransform Root;

            /// <summary>The board and its point, lifted clear of the head.</summary>
            public RectTransform Plate;
        }

        private readonly Dictionary<int, Sign> signs = new Dictionary<int, Sign>();
        private readonly List<int> expired = new List<int>();

        private RectTransform container;
        private float timer;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<NpcNamePlates>() != null)
                return;

            var host = new GameObject("NpcNamePlates");
            DontDestroyOnLoad(host);
            host.AddComponent<NpcNamePlates>();
        }

        private void Update()
        {
            timer -= Time.deltaTime;
            if (timer > 0)
                return;
            timer = SweepInterval;

            var network = NetworkManager.Instance;
            if (network == null || network.OverlayManager == null)
                return;

            foreach (var entry in network.EntityList)
            {
                var entity = entry.Value;
                if (entity == null || entity.CharacterType != CharacterType.NPC)
                    continue;

                if (signs.ContainsKey(entry.Key))
                    continue;

                var name = entity.Name;
                if (!WantsSign(name))
                    continue;

                var sign = BuildSign(name);
                if (sign == null)
                    return; //no canvas yet, try again on the next sweep

                sign.Target = entity;
                signs.Add(entry.Key, sign);
            }
        }

        /// <summary>
        /// Moves every sign onto its NPC.
        ///
        /// In LateUpdate because the camera has finished moving by then. Doing it in Update
        /// leaves the boards a frame behind the world, which shows up as the signs sliding
        /// around whenever the camera turns.
        /// </summary>
        private void LateUpdate()
        {
            if (signs.Count == 0)
                return;

            var cf = CameraFollower.Instance;
            if (cf == null || cf.Camera == null || cf.UiCanvas == null || cf.CanvasScaler == null)
                return;

            var player = cf.TargetControllable;
            var here = player != null ? player.transform.position : cf.transform.position;

            foreach (var entry in signs)
            {
                var sign = entry.Value;
                if (sign.Target == null || sign.Root == null)
                {
                    expired.Add(entry.Key);
                    continue;
                }

                var world = sign.Target.transform.position;
                var near = Vector3.Distance(here, world) <= ShowDistance;
                if (sign.Root.gameObject.activeSelf != near)
                    sign.Root.gameObject.SetActive(near);
                if (!near)
                    continue;

                Snap(cf, sign, world);
            }

            if (expired.Count == 0)
                return;

            foreach (var id in expired)
            {
                if (signs.TryGetValue(id, out var sign) && sign.Root != null)
                    Destroy(sign.Root.gameObject);
                signs.Remove(id);
            }

            expired.Clear();
        }

        /// <summary>
        /// Screen position and zoom scale, copied from the vending sign rather than invented.
        ///
        /// The canvas puts its origin at the top left, which is why the height of the canvas
        /// comes off the y — anything else lands the sign mirrored about the middle of the
        /// screen, which looks like the follow code being broken rather than the sums.
        /// </summary>
        private static void Snap(CameraFollower cf, Sign sign, Vector3 world)
        {
            var screenPos = cf.Camera.WorldToScreenPoint(world);
            var reverseScale = 1f / cf.CanvasScaler.scaleFactor;

            var d = 70 / cf.Distance;
            if (!GameConfig.Data.ScalePlayerDisplayWithZoom)
                d = 1f;
            d *= Screen.height / 1920f * 2f;

            sign.Root.localScale = new Vector3(d, d, d);
            sign.Root.anchoredPosition = new Vector2(screenPos.x * reverseScale,
                (screenPos.y - cf.UiCanvas.pixelRect.height) * reverseScale);

            //Height is read every frame rather than once, because the sprite is often still
            //loading when the sign is built and its height is zero until it arrives.
            if (sign.Plate != null)
                sign.Plate.anchoredPosition = new Vector2(0, StandingHeightOf(sign.Target) + ExtraHeight);
        }

        private static float StandingHeightOf(ServerControllable target)
        {
            //the same measurement the cast bar and the chat bubble use, so a sign sits at the
            //height everything else over that NPC's head sits at
            if (target.SpriteAnimator == null || target.SpriteAnimator.SpriteData == null)
                return 40f;

            var height = target.SpriteAnimator.SpriteData.StandingHeight
                         * 1.5f * (1 / GameConfig.UiScale) + 15;
            return height < 40 ? 40 : height;
        }

        private static bool WantsSign(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                return false;

            //the client prefixes the names of NPCs that are not people — a vending marker, an
            //effect standing in for something — and those were never meant to be read
            if (name.StartsWith("[NPC]"))
                return false;

            foreach (var wanted in SignedNames)
            {
                if (name.IndexOf(wanted, System.StringComparison.OrdinalIgnoreCase) >= 0)
                    return true;
            }

            return false;
        }

        /// <summary>
        /// One signboard: a pale plaque with a dark edge, an icon, the name, and a point at
        /// the bottom aimed at whoever it belongs to.
        ///
        /// The point is what stops it reading as a chat room. A chat room in this game is a
        /// box of text floating over a head and nothing else, so a box of text floating over
        /// a head is a chat room as far as anyone looking at it is concerned.
        /// </summary>
        private Sign BuildSign(string name)
        {
            if (container == null && !BuildContainer())
                return null;

            var root = ModernUiTheme.CreateRect("NpcSign", container);
            root.anchorMin = new Vector2(0, 1);
            root.anchorMax = new Vector2(0, 1);
            root.pivot = new Vector2(0.5f, 0.5f);
            root.sizeDelta = Vector2.zero;

            //Everything the sign is made of hangs off one rect, so raising it clear of the
            //head is one number in one place. Lifting the board on its own is how the point
            //at the bottom ended up left behind on the floor.
            var plate = ModernUiTheme.CreateRect("Plate", root);
            plate.anchorMin = new Vector2(0.5f, 0.5f);
            plate.anchorMax = new Vector2(0.5f, 0.5f);
            plate.pivot = new Vector2(0.5f, 0.5f);
            plate.sizeDelta = Vector2.zero;

            //Built first so it can be measured: how wide the board has to be is a question
            //only the writing on it can answer.
            var label = ModernUiTheme.CreateText(plate, "Name", name, FontSize,
                ModernUiTheme.NameColor, TextAlignmentOptions.Left, FontStyles.Bold);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            var size = label.GetPreferredValues(name);

            var boardWidth = PadX * 2f + IconSize + IconGap + size.x;
            var boardHeight = Mathf.Max(size.y, IconSize) + PadY * 2f;

            //Drawn before the board and therefore behind it, so only the half that sticks out
            //below the bottom edge is seen, which is a point. Two of them, the larger one in
            //the edge colour, so the point has the same dark edge the board does.
            MakeTail(plate, "TailEdge", ModernUiTheme.NameColor, TailSize + BorderWidth * 2f, boardHeight);
            MakeTail(plate, "Tail", ModernUiTheme.WindowColor, TailSize, boardHeight);

            var board = ModernUiTheme.CreateCard(plate, "Board", ModernUiTheme.WindowColor);
            board.anchorMin = new Vector2(0.5f, 0.5f);
            board.anchorMax = new Vector2(0.5f, 0.5f);
            board.pivot = new Vector2(0.5f, 0.5f);
            board.sizeDelta = new Vector2(boardWidth, boardHeight);
            board.GetComponent<Image>().raycastTarget = false;
            ModernUiTheme.AddBorder(board, ModernUiTheme.NameColor);

            var icon = ModernUiTheme.CreateIcon(board, ModernUiIcons.Person,
                ModernUiTheme.AccentInkColor, IconSize);
            var iconRect = (RectTransform)icon.transform;
            iconRect.anchorMin = new Vector2(0, 0.5f);
            iconRect.anchorMax = new Vector2(0, 0.5f);
            iconRect.pivot = new Vector2(0, 0.5f);
            iconRect.anchoredPosition = new Vector2(PadX, 0);
            icon.raycastTarget = false;

            //moved onto the board now that there is one, and left where it was measured
            label.transform.SetParent(board, false);
            var labelRect = label.rectTransform;
            labelRect.anchorMin = new Vector2(0, 0.5f);
            labelRect.anchorMax = new Vector2(0, 0.5f);
            labelRect.pivot = new Vector2(0, 0.5f);
            labelRect.sizeDelta = size;
            labelRect.anchoredPosition = new Vector2(PadX + IconSize + IconGap, 0);

            //Nothing on the sign takes a click. It covers the ground the player has to click
            //on to talk to the NPC underneath it, and a board that eats that click makes the
            //NPC harder to reach than having no sign at all.
            return new Sign { Root = root, Plate = plate };
        }

        private static void MakeTail(Transform parent, string name, Color color, float size, float boardHeight)
        {
            var rect = ModernUiTheme.CreateCard(parent, name, color);
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.sizeDelta = new Vector2(size, size);
            rect.anchoredPosition = new Vector2(0, -boardHeight * 0.5f);
            rect.localRotation = Quaternion.Euler(0, 0, 45f);
            rect.GetComponent<Image>().raycastTarget = false;
        }

        /// <summary>
        /// Somewhere on the canvas to keep the signs.
        ///
        /// Hung off the overlay manager, which is the object the hover plates and chat
        /// bubbles already live under. Doing it that way means never having to work out which
        /// canvas is the right one or how it is anchored — whatever is true for a nameplate
        /// is true for a sign.
        /// </summary>
        private bool BuildContainer()
        {
            var overlay = NetworkManager.Instance != null ? NetworkManager.Instance.OverlayManager : null;
            if (overlay == null)
                return false;

            //Pinned to the top left corner with no size of its own. The screen arithmetic the
            //client uses for overlays measures down from the top left, so that corner is the
            //origin every sign is placed from — and a rect with no size cannot disagree with
            //its parent about where its own corners are.
            container = ModernUiTheme.CreateRect("NpcSigns", overlay.transform);
            container.anchorMin = new Vector2(0, 1);
            container.anchorMax = new Vector2(0, 1);
            container.pivot = new Vector2(0, 1);
            container.sizeDelta = Vector2.zero;
            container.anchoredPosition = Vector2.zero;
            container.localScale = Vector3.one;
            //behind the health bars and hover plates rather than over them
            container.SetAsFirstSibling();
            return true;
        }
    }
}
