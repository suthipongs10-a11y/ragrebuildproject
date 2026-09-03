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
    /// there, which is the same problem the drop aura solved, so it is solved the same way.
    ///
    /// The art is its own rather than borrowed from the drop aura. The ring the drop aura
    /// uses is the client's cast-target decal, and that texture carries a lot of empty
    /// margin around the circle it draws: asking for a ring a certain number of units across
    /// gets a texture that wide with a much smaller circle inside it, which is why the first
    /// attempt at this came out a quarter of the size the numbers said. Everything below
    /// fills its own texture out to the edge, so a width here is the width on screen.
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

        //Widths in world units, and a character stands about a unit and a half. These are
        //deliberately far wider than the body: the aura is meant to be seen from across a
        //field and to say "that one" before you have read anything, so the haze reaches
        //about three body widths out and everything inside it is stacked toward the middle.
        private const float HazeWidth = 5.0f;
        private const float SwirlWidth = 3.8f;
        private const float RingWidth = 2.9f;
        private const float GlowWidth = 2.2f;

        /// <summary>Off the floor by enough not to fight the ground for the same pixels.</summary>
        private const float Lift = 0.06f;

        /// <summary>Degrees a second, and the swirl turns against the ring.</summary>
        private const float Spin = 34f;

        /// <summary>
        /// Specks climbing out of the ring, which is most of what separates a lit circle
        /// from something happening. Twelve rather than the drop aura's eight, because this
        /// is a wider ring and the same number spread over it reads as sparse.
        /// </summary>
        private const int MoteCount = 12;

        private const float MoteRise = 0.45f;
        private const float MoteHeight = 2.3f;
        private const float MoteRadius = 1.05f;

        private const int Size = 160;
        private const int SwirlArms = 6;

        /// <summary>
        /// Written darker than it should look, like every colour in the drop aura and for the
        /// same reason: these are additive layers, so what reaches the screen is the tint
        /// times however many of them cover the pixel. A cyan written at full brightness
        /// comes out white the moment two layers overlap, and white says nothing.
        /// </summary>
        private static readonly Color AuraColor = new Color(0.14f, 0.58f, 1.00f);

        private static Sprite hazeSprite;
        private static Sprite ringSprite;
        private static Sprite swirlSprite;
        private static Sprite moteSprite;

        private ServerControllable owner;
        private Transform parts;
        private SpriteRenderer haze;
        private SpriteRenderer swirl;
        private SpriteRenderer ring;
        private SpriteRenderer glow;
        private SpriteRenderer[] motes;
        private float ringAngle;
        private float swirlAngle;
        private float phase;

        /// <summary>Looked up once. Camera.main is a tag search and this runs every frame.</summary>
        private Transform view;

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

            //Widest first. They are additive so none of them hides another, but the broad
            //faint one is what the rest are read against.
            haze = MakePart("Haze", HazeSprite, HazeWidth);
            swirl = MakePart("Swirl", SwirlSprite, SwirlWidth);
            ring = MakePart("Ring", RingSprite, RingWidth);
            glow = MakePart("Glow", HazeSprite, GlowWidth);

            motes = new SpriteRenderer[MoteCount];
            for (var i = 0; i < MoteCount; i++)
            {
                //three sizes in rotation, so the column has some depth to it rather than
                //looking like one speck copied a dozen times
                motes[i] = MakePart("Mote" + i, MoteSprite, 0.16f + (i % 3) * 0.09f);
            }
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

            Paint(haze, 0.34f + pulse * 0.16f);
            Paint(swirl, 0.62f + pulse * 0.24f);
            Paint(ring, 0.85f + pulse * 0.15f);
            Paint(glow, 0.50f + pulse * 0.20f);

            LayOnGround(haze, ref swirlAngle, 0f);
            LayOnGround(glow, ref swirlAngle, 0f);
            LayOnGround(ring, ref ringAngle, 1f);
            LayOnGround(swirl, ref swirlAngle, -0.7f);

            DriftMotes(t);
        }

        /// <summary>
        /// Carries the specks up out of the ring and fades them out on the way.
        /// </summary>
        /// <remarks>
        /// Each one rides its own loop rather than carrying a timer: the fractional part of a
        /// number that only ever grows is a sawtooth from nought to one, and a dozen of them
        /// offset by a twelfth is a steady stream with nothing to keep track of. They face
        /// the camera rather than lying flat, because they are meant to read as sparks in the
        /// air rather than as marks on the floor.
        /// </remarks>
        private void DriftMotes(float t)
        {
            if (motes == null)
                return;

            if (view == null && Camera.main != null)
                view = Camera.main.transform;

            for (var i = 0; i < motes.Length; i++)
            {
                var mote = motes[i];
                if (mote == null)
                    continue;

                var life = Mathf.Repeat(t * MoteRise + i / (float)motes.Length, 1f);

                //a slow spiral inward as it climbs, so the column narrows toward the top and
                //the whole thing reads as being drawn up rather than blown about
                var angle = i * 2.1f + life * 2.6f;
                var radius = MoteRadius * (1f - life * 0.55f);

                mote.transform.position = transform.position + new Vector3(
                    Mathf.Cos(angle) * radius,
                    Lift + life * MoteHeight,
                    Mathf.Sin(angle) * radius);

                if (view != null)
                    mote.transform.rotation = view.rotation;

                //born out of nothing at the foot and gone before the top, so the column has
                //no hard end to it at either end
                var fade = Mathf.Sin(life * Mathf.PI);
                mote.color = new Color(1f, 1f, 1f, fade * 0.85f);
            }
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

        /// <summary>
        /// A broad soft pool with no edge to it, which is what makes the whole thing read as
        /// glow rather than as a disc lying on the grass.
        /// </summary>
        /// <remarks>
        /// The falloff is gentler than a square. Squaring pulls the light into the middle and
        /// leaves a visible rim where it runs out; a power near one lets it thin out over the
        /// whole radius instead, so there is no point at which it stops.
        /// </remarks>
        private static Sprite HazeSprite
        {
            get
            {
                if (hazeSprite != null)
                    return hazeSprite;

                hazeSprite = Draw((distance, angle) =>
                    Mathf.Pow(Mathf.Clamp01(1f - distance), 1.25f) * 0.9f);
                return hazeSprite;
            }
        }

        /// <summary>The bright line of the circle itself, close to the outer edge.</summary>
        private static Sprite RingSprite
        {
            get
            {
                if (ringSprite != null)
                    return ringSprite;

                ringSprite = Draw((distance, angle) =>
                {
                    var band = Mathf.Clamp01(1f - Mathf.Abs(distance - 0.78f) / 0.16f);
                    return band * band;
                });
                return ringSprite;
            }
        }

        /// <summary>
        /// A broad turning band with arms swept round it.
        /// </summary>
        /// <remarks>
        /// A circle of even brightness gives nothing away when it turns - every frame looks
        /// like the last one - so it reads as a decal sitting there rather than as something
        /// swirling. Offsetting each arm by the radius bends them into a spiral, so the
        /// inside of the band appears to lag behind the outside.
        /// </remarks>
        private static Sprite SwirlSprite
        {
            get
            {
                if (swirlSprite != null)
                    return swirlSprite;

                swirlSprite = Draw((distance, angle) =>
                {
                    var band = Mathf.Clamp01(1f - Mathf.Abs(distance - 0.60f) / 0.36f);
                    band *= band;
                    //never all the way down to nothing between the arms, so the band stays a
                    //band rather than becoming a ring of separate blobs
                    var arms = 0.55f + 0.45f * Mathf.Sin(angle * SwirlArms + distance * 7f);
                    return band * arms;
                });
                return swirlSprite;
            }
        }

        /// <summary>One speck, soft enough to have no edge at the size it is drawn.</summary>
        private static Sprite MoteSprite
        {
            get
            {
                if (moteSprite != null)
                    return moteSprite;

                moteSprite = Draw((distance, angle) =>
                {
                    var a = Mathf.Clamp01(1f - distance);
                    return a * a;
                });
                return moteSprite;
            }
        }

        /// <summary>
        /// Builds one of the textures above from a function of radius and angle.
        /// </summary>
        /// <remarks>
        /// Every one of these fills its texture out to the edge, which is the whole reason
        /// they are drawn here instead of borrowed: a width asked for is then the width that
        /// appears, with no invisible margin to swallow it.
        /// </remarks>
        private static Sprite Draw(System.Func<float, float, float> shape)
        {
            var texture = new Texture2D(Size, Size, TextureFormat.RGBA32, false);
            texture.wrapMode = TextureWrapMode.Clamp;

            var half = Size * 0.5f;
            for (var y = 0; y < Size; y++)
            {
                for (var x = 0; x < Size; x++)
                {
                    var dx = (x + 0.5f - half) / half;
                    var dy = (y + 0.5f - half) / half;
                    var distance = Mathf.Sqrt(dx * dx + dy * dy);
                    var angle = Mathf.Atan2(dy, dx);

                    texture.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Clamp01(shape(distance, angle))));
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, Size, Size), new Vector2(0.5f, 0.5f), 100);
        }
    }
}
