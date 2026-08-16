using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;

namespace Assets.Scripts.UI.Hud
{
    /// <summary>
    /// Stands a sign over every NPC, permanently.
    ///
    /// The client only ever puts a name up while the pointer is over something or while it
    /// is the target, which is right for monsters — a field with forty labels floating over
    /// it is unreadable — and wrong for NPCs. An NPC is a thing you walk up to on purpose,
    /// and you cannot do that if finding out what it is means hovering every figure in
    /// town. The Job Master is the one that made the point: renaming him changed nothing
    /// anybody could see, and the hover plate, when it did appear, was small dark text.
    ///
    /// So this is a sign of its own rather than the hover plate held open: a pale board with
    /// a dark edge, an icon and the name on it, standing over the head and readable from
    /// where you are. The hover plate is not that and should not be — it has monsters to
    /// label too, and forty boards over a field is worse than none.
    /// </summary>
    public class NpcNamePlates : MonoBehaviour
    {
        /// <summary>
        /// Slow on purpose. It exists to catch NPCs that have just come into view; the sign
        /// stays up on its own in between.
        /// </summary>
        private const float SweepInterval = 0.5f;

        /// <summary>Above the head rather than through it. Sprites here stand 1.5 tall.</summary>
        private const float SignHeight = 2.05f;

        /// <summary>
        /// Only signs the NPCs you are near enough to walk to.
        ///
        /// Every NPC in view carrying one turned a camp into a wall of boards. A sign is for
        /// finding the person in front of you, so it appears when you are near enough for
        /// that to be the question.
        /// </summary>
        private const float ShowDistance = 11f;

        //Built at a font size TextMeshPro is comfortable with and then shrunk as a whole.
        //Setting the font size to the final world height instead — 0.6 of a unit — is what
        //produced boards with an illegible smear in them: at that size the glyphs have
        //almost no texture left to draw with. Building large and scaling down keeps the text
        //and the board in proportion whatever either of them turns out to measure.
        private const float SignScale = 0.13f;
        private const float FontSize = 4f;
        private const float PadX = 1.1f;
        private const float PadY = 0.7f;
        private const float IconSize = 2.4f;
        private const float IconGap = 0.6f;
        private const float BorderWidth = 0.2f;
        private const string SignName = "NpcSign";

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
            if (network == null)
                return;

            var player = CameraFollower.Instance != null ? CameraFollower.Instance.TargetControllable : null;
            if (player == null)
                return;

            var here = player.transform.position;

            foreach (var entry in network.EntityList)
            {
                var entity = entry.Value;
                if (entity == null || entity.CharacterType != CharacterType.NPC)
                    continue;

                //Some NPCs are not people: a vending sign, a chat room marker, an effect
                //standing in for something. Those carry a name the player was never meant
                //to read, and the client marks them by prefixing it.
                var name = entity.Name;
                if (string.IsNullOrWhiteSpace(name) || name.StartsWith("[NPC]"))
                    continue;

                var sign = entity.transform.Find(SignName);
                if (sign == null)
                    sign = BuildSign(entity.transform, name);

                var near = Vector3.Distance(here, entity.transform.position) <= ShowDistance;
                if (sign.gameObject.activeSelf != near)
                    sign.gameObject.SetActive(near);
            }
        }

        /// <summary>
        /// A signboard: a pale plaque with a dark edge, an icon, and the name written on it.
        ///
        /// Built in its own units and shrunk at the end, so everything on it stays in
        /// proportion. Sized to the text rather than to a guess, so a long name is not
        /// clipped and a short one is not adrift in an oversized plaque.
        /// </summary>
        private static Transform BuildSign(Transform parent, string name)
        {
            var root = new GameObject(SignName);
            root.transform.SetParent(parent, false);
            root.transform.localPosition = new Vector3(0, SignHeight, 0);
            root.transform.localScale = Vector3.one * SignScale;
            //faces the camera, and everything hung on it turns with it
            root.AddComponent<BillboardObject>();

            //Built first and measured, because how wide the board has to be is a question
            //only the text can answer.
            var textObject = new GameObject("Name");
            textObject.transform.SetParent(root.transform, false);

            var text = textObject.AddComponent<TextMeshPro>();
            if (ModernUiTheme.ThemeFont != null)
                text.font = ModernUiTheme.ThemeFont;

            text.text = name;
            text.fontSize = FontSize;
            text.color = ModernUiTheme.NameColor;
            text.fontStyle = FontStyles.Bold;
            text.alignment = TextAlignmentOptions.Left;
            text.enableWordWrapping = false;
            text.raycastTarget = false;
            text.ForceMeshUpdate();

            var textWidth = Mathf.Max(text.preferredWidth, 1f);
            var textHeight = Mathf.Max(text.preferredHeight, FontSize);

            var boardWidth = PadX * 2f + IconSize + IconGap + textWidth;
            var boardHeight = Mathf.Max(textHeight, IconSize) + PadY * 2f;

            //the dark edge is a second board very slightly larger behind the first, which is
            //the same trick the interface uses for its own panels
            MakePanel(root.transform, "Border", ModernUiTheme.NameColor,
                boardWidth + BorderWidth * 2f, boardHeight + BorderWidth * 2f, 0);
            MakePanel(root.transform, "Panel", ModernUiTheme.WindowColor,
                boardWidth, boardHeight, 1);

            var left = -boardWidth * 0.5f;

            var icon = new GameObject("Icon");
            icon.transform.SetParent(root.transform, false);
            icon.transform.localPosition = new Vector3(left + PadX + IconSize * 0.5f, 0f, 0f);
            var iconRenderer = icon.AddComponent<SpriteRenderer>();
            iconRenderer.sprite = ModernUiIcons.Person;
            iconRenderer.color = ModernUiTheme.AccentInkColor;
            iconRenderer.sortingOrder = 2;

            //scaled rather than sliced: slicing needs a border the icon sprites do not have,
            //and scaling lands on the right size whatever their own pixels-per-unit is
            var iconBounds = iconRenderer.sprite != null ? iconRenderer.sprite.bounds.size.x : 0f;
            if (iconBounds > 0.0001f)
                icon.transform.localScale = Vector3.one * (IconSize / iconBounds);

            text.rectTransform.sizeDelta = new Vector2(textWidth, textHeight);
            text.rectTransform.localPosition =
                new Vector3(left + PadX + IconSize + IconGap + textWidth * 0.5f, 0f, 0f);

            //Sorting order rather than depth, because all of this is coplanar: three quads
            //at the same distance from the camera would otherwise fight over which is in
            //front and the answer would change as the camera moved.
            var textRenderer = textObject.GetComponent<MeshRenderer>();
            if (textRenderer != null)
                textRenderer.sortingOrder = 3;

            return root.transform;
        }

        private static void MakePanel(Transform parent, string name, Color color,
            float width, float height, int order)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);

            var renderer = go.AddComponent<SpriteRenderer>();
            renderer.sprite = ModernUiTheme.RoundedSprite;
            //the rounded sprite is built with a border, so it stretches without the corners
            //smearing
            renderer.drawMode = SpriteDrawMode.Sliced;
            renderer.size = new Vector2(width, height);
            renderer.color = color;
            renderer.sortingOrder = order;
        }
    }
}
