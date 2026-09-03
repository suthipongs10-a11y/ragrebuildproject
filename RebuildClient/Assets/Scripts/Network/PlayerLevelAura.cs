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
        private const float HazeWidth = 5.2f;
        private const float SwirlWidth = 4.0f;
        private const float RingWidth = 2.9f;

        /// <summary>
        /// Where the circle actually is, in world units of radius. The haze starts here and
        /// runs outward, the swirl is centred on it, the wisps rise from it. Inside it there
        /// is nothing at all, which is the point: the reference is a bright line with grass
        /// showing through the middle, not a pool somebody is standing in.
        /// </summary>
        private const float RingRadius = 1.30f;

        /// <summary>
        /// How much of the middle stays empty, in world units of radius.
        ///
        /// The feet are the one part of the character the aura is standing on, and an aura
        /// painted over them reads as the character sinking into it rather than as light
        /// coming off the floor around them. Every layer is cut out to this radius, and
        /// because they are different widths each one is cut at a different fraction of its
        /// own texture - which is why the number is in world units and divided per layer
        /// rather than written as a fraction once.
        /// </summary>
        private const float FeetRadius = 0.34f;

        /// <summary>Off the floor by enough not to fight the ground for the same pixels.</summary>
        private const float Lift = 0.06f;

        /// <summary>Degrees a second, and the swirl turns against the ring.</summary>
        private const float Spin = 34f;

        /// <summary>
        /// Specks climbing out of the ring, which is most of what separates a lit circle
        /// from something happening. Twelve rather than the drop aura's eight, because this
        /// is a wider ring and the same number spread over it reads as sparse.
        /// </summary>
        private const int MoteCount = 16;

        private const float MoteRise = 0.72f;
        private const float MoteHeight = 3.2f;
        private const float MoteRadius = RingRadius;

        /// <summary>
        /// How much taller than wide a speck is drawn.
        ///
        /// A round speck moving up reads as a round speck that happens to be somewhere else
        /// this frame. Stretching it along the direction it travels is what the eye reads as
        /// speed, and it costs nothing - the quad is already facing the camera.
        /// </summary>
        private const float MoteStretch = 3.0f;

        /// <summary>How far a wisp wanders sideways on the way up, in world units.</summary>
        private const float MoteSway = 0.16f;

        private const int Size = 160;
        private const int SwirlArms = 6;

        /// <summary>
        /// White, with just enough blue left in it to read as light rather than as paper.
        /// </summary>
        /// <remarks>
        /// Written darker than it should look, like every colour in the drop aura and for the
        /// same reason: these are additive layers, so what reaches the screen is the tint
        /// times however many of them cover the pixel. Written at full brightness the middle
        /// clips to flat white and the edges go with it; written at about two thirds, the
        /// core still clips white where the layers pile up and the spread keeps its tint.
        ///
        /// One colour for now. Splitting it by adventure rank needs the rank of the person
        /// the aura belongs to, and the client only knows its own - so that is a byte in the
        /// player spawn packet, not a change to this file.
        /// </remarks>
        private static readonly Color AuraColor = new Color(0.62f, 0.72f, 0.80f);

        private static Sprite hazeSprite;
        private static Sprite ringSprite;
        private static Sprite swirlSprite;
        private static Sprite moteSprite;

        private ServerControllable owner;
        private Transform parts;
        private SpriteRenderer haze;
        private SpriteRenderer swirl;
        private SpriteRenderer ring;
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

            motes = new SpriteRenderer[MoteCount];
            for (var i = 0; i < MoteCount; i++)
            {
                //three sizes in rotation, so the column has some depth to it rather than
                //looking like one speck copied twenty times
                var width = 0.15f + (i % 3) * 0.08f;
                var mote = MakePart("Mote" + i, MoteSprite, width);
                var scale = mote.transform.localScale;
                scale.y *= MoteStretch;
                mote.transform.localScale = scale;
                motes[i] = mote;
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

            //These add. The first attempt had four layers at two thirds or more each, which
            //came to well over one wherever they overlapped, and over one is white: the ring,
            //the swirl and the hole in the middle were all in there and none of them could
            //be seen. The ring is the one thing allowed to reach white. The rest sit far
            //enough under it that the sum only clips on the line itself.
            Paint(haze, 0.20f + pulse * 0.08f);
            Paint(swirl, 0.28f + pulse * 0.12f);
            Paint(ring, 0.95f + pulse * 0.05f);

            LayOnGround(haze, ref swirlAngle, 0f);
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

                //and a wander on top of that, on its own beat per wisp. Twenty-two things
                //rising on identical paths read as a machine; the same twenty-two with a
                //waver in them read as fire.
                var sway = Mathf.Sin(t * 3.1f + i * 1.7f) * MoteSway * life;

                mote.transform.position = transform.position + new Vector3(
                    Mathf.Cos(angle) * radius + sway,
                    Lift + life * MoteHeight,
                    Mathf.Sin(angle) * radius);

                if (view != null)
                    mote.transform.rotation = view.rotation;

                //born out of nothing at the foot and gone before the top, so the column has
                //no hard end to it at either end
                var fade = Mathf.Sin(life * Mathf.PI);
                mote.color = new Color(1f, 1f, 1f, fade * 0.55f);
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
        /// The spread: from the ring outward, and nothing inside it.
        /// </summary>
        /// <remarks>
        /// It used to fill the whole disc and so it filled the middle, over the feet, and
        /// the sum of it and everything else there went to white. Now it starts at the ring
        /// and runs out as a straight ramp - straight rather than curved because a curve
        /// pulls the light back in toward the line and leaves the outer half empty, and it
        /// is the outer half that reads as light thrown across the floor.
        /// </remarks>
        private static Sprite HazeSprite
        {
            get
            {
                if (hazeSprite != null)
                    return hazeSprite;

                //where the ring sits, as a fraction of this texture's radius
                var at = RingRadius / (HazeWidth * 0.5f);

                hazeSprite = Draw(HazeWidth, (distance, angle) =>
                {
                    //nothing inside the line, a short soft step up at it, then a ramp down
                    var inside = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((distance - at * 0.94f) / (at * 0.10f)));
                    var outward = Mathf.Clamp01((1f - distance) / (1f - at));
                    return inside * outward * 0.9f;
                });
                return hazeSprite;
            }
        }

        /// <summary>The bright line of the circle itself. Thin, and the only thing that clips.</summary>
        private static Sprite RingSprite
        {
            get
            {
                if (ringSprite != null)
                    return ringSprite;

                var at = RingRadius / (RingWidth * 0.5f);

                ringSprite = Draw(RingWidth, (distance, angle) =>
                {
                    var band = Mathf.Clamp01(1f - Mathf.Abs(distance - at) / 0.055f);
                    return band * band;
                });
                return ringSprite;
            }
        }

        /// <summary>
        /// A broad turning band centred on the ring, with arms swept round it.
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

                var at = RingRadius / (SwirlWidth * 0.5f);

                swirlSprite = Draw(SwirlWidth, (distance, angle) =>
                {
                    var band = Mathf.Clamp01(1f - Mathf.Abs(distance - at) / 0.22f);
                    band *= band;
                    //never all the way down to nothing between the arms, so the band stays a
                    //band rather than becoming a ring of separate blobs
                    var arms = 0.55f + 0.45f * Mathf.Sin(angle * SwirlArms + distance * 7f);
                    return band * arms;
                });
                return swirlSprite;
            }
        }

        /// <summary>
        /// One wisp: a soft blade of light, wide at the foot and tapering to nothing.
        /// </summary>
        /// <remarks>
        /// Round specks were wrong. What comes off an aura is not a spray of dots, it is
        /// something more like flame - a shape that is already pointing the way it is going
        /// before it moves at all - and a tapered blade reads as that standing still, which a
        /// circle never does however fast you push it.
        /// </remarks>
        private static Sprite MoteSprite
        {
            get
            {
                if (moteSprite != null)
                    return moteSprite;

                //no clearance on this one: a hollow wisp is an outline, not a wisp
                moteSprite = Draw(0f, (distance, angle) =>
                {
                    var across = distance * Mathf.Cos(angle);
                    var along = distance * Mathf.Sin(angle);

                    //narrower the higher it goes, so it comes to a point at the tip
                    var width = 0.34f * (1f - Mathf.Clamp01((along + 1f) * 0.5f) * 0.72f);
                    var side = Mathf.Clamp01(1f - Mathf.Abs(across) / Mathf.Max(width, 0.03f));
                    side *= side;

                    //soft at the foot and gone before the top, so it has no hard end
                    var length = Mathf.Clamp01(1f - Mathf.Abs(along));

                    return side * length;
                });
                return moteSprite;
            }
        }

        /// <summary>
        /// Builds one of the textures above from a function of radius and angle, with the
        /// middle cut out so the feet show through.
        /// </summary>
        /// <remarks>
        /// Every one of these fills its texture out to the edge, which is the whole reason
        /// they are drawn here instead of borrowed: a width asked for is then the width that
        /// appears, with no invisible margin to swallow it.
        ///
        /// The hole is given in world units and turned into a fraction of this particular
        /// texture, so four layers of four different widths all clear the same circle on the
        /// floor. Pass a width of zero for something that should not be hollow at all.
        /// </remarks>
        private static Sprite Draw(float worldWidth, System.Func<float, float, float> shape)
        {
            var texture = new Texture2D(Size, Size, TextureFormat.RGBA32, false);
            texture.wrapMode = TextureWrapMode.Clamp;

            //the fraction of this texture's radius that the feet take up
            var clear = worldWidth > 0.0001f ? FeetRadius / (worldWidth * 0.5f) : 0f;
            //softened over a tenth of the radius, so the hole has an edge you cannot see
            var fade = Mathf.Max(clear * 0.35f, 0.02f);

            var half = Size * 0.5f;
            for (var y = 0; y < Size; y++)
            {
                for (var x = 0; x < Size; x++)
                {
                    var dx = (x + 0.5f - half) / half;
                    var dy = (y + 0.5f - half) / half;
                    var distance = Mathf.Sqrt(dx * dx + dy * dy);
                    var angle = Mathf.Atan2(dy, dx);

                    var alpha = Mathf.Clamp01(shape(distance, angle));

                    if (clear > 0f)
                        alpha *= Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((distance - clear) / fade));

                    texture.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, Size, Size), new Vector2(0.5f, 0.5f), 100);
        }
    }
}
