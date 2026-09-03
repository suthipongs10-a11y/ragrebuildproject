using UnityEngine;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// The ring of light under a character who has reached the level cap.
    /// </summary>
    /// <remarks>
    /// Drawn here rather than imported. The aura is a standard thing to have and the obvious
    /// move was to reach for it in the effect table, but there is no aura in there - the
    /// hundred and forty odd effects the client knows are all skills, and every one of them
    /// plays once and finishes. This has to sit under somebody for as long as they stand
    /// there, which is the same problem the drop aura solved, so it is solved the same way
    /// and out of the same art.
    ///
    /// It reads the level off the character rather than being told when to appear. The
    /// client already knows what level everything on screen is - it is in the spawn packet
    /// and it is what the name plate prints - so there is nothing to send, nothing to keep
    /// in step, and somebody who dings ninety-nine in front of you lights up without a
    /// packet being written for it.
    /// </remarks>
    public class PlayerLevelAura : MonoBehaviour
    {
        /// <summary>The level that earns it. The one number worth having in one place.</summary>
        private const int AuraLevel = 99;

        /// <summary>
        /// Widths in world units. A character stands about a unit and a half, so a ring a
        /// little over one across sits under the feet rather than around the whole body -
        /// which is what makes it read as standing on something rather than wearing it.
        /// </summary>
        private const float RingWidth = 1.05f;

        private const float SwirlWidth = 1.45f;
        private const float GlowWidth = 0.95f;

        /// <summary>Off the floor by enough not to fight the ground for the same pixels.</summary>
        private const float Lift = 0.06f;

        /// <summary>Degrees a second, and the swirl turns against the ring.</summary>
        private const float Spin = 30f;

        /// <summary>
        /// Written darker than it should look, like every colour in the drop aura and for the
        /// same reason: these are additive layers, so what reaches the screen is the tint
        /// times however many of them cover the pixel. A cyan written at full brightness
        /// comes out white the moment two layers overlap, and white says nothing.
        /// </summary>
        private static readonly Color AuraColor = new Color(0.16f, 0.62f, 1.00f);

        private ServerControllable owner;
        private Transform parts;
        private SpriteRenderer ring;
        private SpriteRenderer swirl;
        private SpriteRenderer glow;
        private float ringAngle;
        private float swirlAngle;
        private float phase;

        /// <summary>
        /// Puts the watcher on a character. Cheap for everybody who will never need it: with
        /// nothing to show it builds nothing and does an integer comparison per frame.
        /// </summary>
        public static void Attach(ServerControllable control)
        {
            if (control == null || control.gameObject == null)
                return;

            if (control.GetComponent<PlayerLevelAura>() != null)
                return;

            var aura = control.gameObject.AddComponent<PlayerLevelAura>();
            aura.owner = control;
            aura.phase = Random.value * 10f;
        }

        private void Update()
        {
            if (owner == null)
            {
                if (parts != null)
                    parts.gameObject.SetActive(false);
                return;
            }

            var wanted = owner.Level >= AuraLevel && !owner.IsHidden;

            if (!wanted)
            {
                if (parts != null && parts.gameObject.activeSelf)
                    parts.gameObject.SetActive(false);
                return;
            }

            if (parts == null)
                Build();
            else if (!parts.gameObject.activeSelf)
                parts.gameObject.SetActive(true);

            Apply(Time.time + phase);
        }

        private void Build()
        {
            var go = new GameObject("LevelAura");
            go.layer = gameObject.layer;
            go.transform.SetParent(transform, false);
            parts = go.transform;

            //Order matters only in that the broad one goes down first: they are additive, so
            //they do not hide each other, but the one underneath is the one whose colour the
            //others build on.
            swirl = MakePart("Swirl", GroundItemAura.SwirlSprite, SwirlWidth);
            ring = MakePart("Ring", GroundItemAura.RingSprite, RingWidth);
            glow = MakePart("Glow", GroundItemAura.GlowSprite, GlowWidth);
        }

        private SpriteRenderer MakePart(string name, Sprite sprite, float width)
        {
            var go = new GameObject(name);
            go.layer = parts.gameObject.layer;
            go.transform.SetParent(parts, false);

            var renderer = go.AddComponent<SpriteRenderer>();
            renderer.sprite = sprite;
            //under the character rather than over it, so the feet are never covered
            renderer.sortingOrder = -1;

            //The widths above are world units, and a player object is built at one and a
            //half, so what is asked for here has to be divided by that or the ring comes out
            //half again as wide as the number says. Read off the object rather than written
            //down, because a mounted character is scaled differently again.
            var parentScale = parts.lossyScale.x;
            if (parentScale < 0.0001f)
                parentScale = 1f;
            renderer.transform.localScale = GroundItemAura.ScaleFor(sprite, width / parentScale);

            var material = GroundItemAura.MaterialFor(AuraColor);
            if (material != null)
                renderer.sharedMaterial = material;

            return renderer;
        }

        private void Apply(float t)
        {
            //a slow breath, the same one the drop aura uses. The eye is caught by something
            //that moves and annoyed by something that flashes.
            var pulse = 0.5f + 0.5f * Mathf.Sin(t * 2.2f);

            Paint(swirl, 0.55f + pulse * 0.25f);
            Paint(ring, 0.80f + pulse * 0.20f);
            Paint(glow, 0.35f + pulse * 0.15f);

            LayOnGround(ring, ref ringAngle, 1f);
            LayOnGround(swirl, ref swirlAngle, -0.7f);
            LayOnGround(glow, ref swirlAngle, 0f);
        }

        private static void Paint(SpriteRenderer renderer, float amount)
        {
            if (renderer != null)
                renderer.color = new Color(1f, 1f, 1f, amount);
        }

        /// <summary>
        /// Keeps a part flat on the floor and turning, whatever the character above it is
        /// doing.
        /// </summary>
        /// <remarks>
        /// Position and rotation are both set in world terms, for the reason the drop aura
        /// sets them that way: the thing this hangs off carries a billboard that copies the
        /// camera's rotation outright, pitch included, so underneath it there is no such
        /// thing as level. A child asked to lie flat in its parent's terms would tilt with
        /// the camera and a child offset downward would slide sideways as the camera turned.
        /// </remarks>
        private void LayOnGround(SpriteRenderer renderer, ref float angle, float speed)
        {
            if (renderer == null)
                return;

            if (speed != 0f)
                angle = Mathf.Repeat(angle + Time.deltaTime * Spin * speed, 360f);

            renderer.transform.position = transform.position + new Vector3(0, Lift, 0);
            renderer.transform.rotation = Quaternion.Euler(90f, angle, 0f);
        }
    }
}
