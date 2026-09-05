using UnityEngine;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// The burst of light at the feet of a character who has reached the level cap: a white
    /// pool at the boots, a dense fan of soft rays coming out of it and lying on the floor,
    /// and a few sparks climbing off it.
    /// </summary>
    /// <remarks>
    /// Drawn here rather than imported. The aura is a standard thing to have and the obvious
    /// move was to reach for it in the effect table, but there is no aura in there - the
    /// hundred and forty odd effects the client knows are all skills, and every one of them
    /// plays once and finishes. This has to sit under somebody for as long as they stand
    /// there, which is the same problem the drop aura solved, so it is solved the same way.
    ///
    /// Every part of it faces the camera. The first version lay flat on the floor, the way a
    /// ground decal would, and that was wrong twice over: a flat ring read as a hoop drawn
    /// round the feet rather than as light coming off them, and on any slope the flat quad
    /// cut through the ground, so half of it vanished the moment the character walked over
    /// a change in level. A camera-facing quad cannot intersect the terrain however the
    /// terrain is shaped, so the floor is faked instead: the pool is an ellipse squashed by
    /// the camera's pitch, and every ray is cut to the radius of that same ellipse in its
    /// own direction, which is what a starburst lying on the floor looks like from above.
    ///
    /// The quads still dip below the ground plane on the side nearest the camera, which is
    /// why they are drawn without a depth test at all: with one, the terrain in front would
    /// clip the lower half of the pool off. Nothing here writes depth, and everything is
    /// drawn in the queue before the character sprites, so the feet stay visible and the
    /// ground never wins. The queue rather than the sorting order, because the first
    /// version sat one queue after the sprites with a sorting order below them and painted
    /// straight over the feet: between queues the order is not consulted at all.
    ///
    /// The shape is the reference's and nothing else: a starburst about as wide as the
    /// character is tall and half as high on screen, jagged at the edge, white in the middle
    /// and cold at the tips. Two versions came between this one and the first - four white
    /// rings, then one ring with haze drifting out of it - and both read as something other
    /// than the reference, the rings as drawn circles and the haze as blots that had come
    /// loose. So neither is here. The edge is the rays, the rays lie on the floor, and the
    /// only things that move are their slow breathing and the sparks.
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

        //Widths in world units. The pool sits inside the rays, the core is the white heart
        //behind the boots, and the halo is a faint spread wider than everything else.
        private const float PoolWidth = 2.2f;
        private const float CoreWidth = 1.2f;
        private const float HaloWidth = 3.4f;

        /// <summary>
        /// The rays come in two kinds, because the reference has two kinds in it: broad soft
        /// petals that give the burst a body, and thin bright spikes that give it its edge.
        /// Petals alone were a cloud and spikes alone were a pinwheel; together they are a
        /// starburst. The spikes are the many, so the edge is dense and jagged the way the
        /// reference's is.
        /// </summary>
        private const int PetalCount = 8;
        private const int SpikeCount = 20;

        /// <summary>
        /// How far each kind reaches from the centre at full stretch, in world units, out to
        /// the sides. Going up or down the screen they are cut shorter, see Reach.
        /// </summary>
        private const float PetalLength = 1.3f;
        private const float SpikeLength = 1.7f;

        /// <summary>How wide each kind is at its foot, in world units.</summary>
        private const float PetalWidth = 1.0f;
        private const float SpikeWidth = 0.32f;

        /// <summary>
        /// Every other spike is this much shorter than its neighbours, which is what gives
        /// the edge its jag. Twenty of the same length read as a cog.
        /// </summary>
        private const float SpikeStagger = 0.78f;

        /// <summary>
        /// Degrees a second each fan turns. Slow, and against each other: two fans turning
        /// the same way would lock into a single wheel, and the rays are meant to cross.
        /// </summary>
        private const float PetalSpin = 6f;
        private const float SpikeSpin = -4f;

        /// <summary>
        /// Sparks climbing out of the pool. Few, and small: in the reference they are a
        /// glint here and there, not a column.
        /// </summary>
        private const int MoteCount = 12;

        private const float MoteRise = 0.28f;
        private const float MoteHeight = 2.6f;
        private const float MoteRadius = 0.8f;

        /// <summary>How far a spark wanders sideways on the way up, in world units.</summary>
        private const float MoteSway = 0.2f;

        private const int Size = 160;

        /// <summary>
        /// The body of the light: white, with just enough blue left in it to read as light
        /// rather than as paper.
        /// </summary>
        /// <remarks>
        /// Written darker than it should look, like every colour in the drop aura and for the
        /// same reason: these are additive layers, so what reaches the screen is the tint
        /// times however many of them cover the pixel. The pool, the core and the feet of
        /// twenty-odd rays all pile up on the same few pixels, and that is where it goes
        /// white - which is right, that is what the reference does - while further out,
        /// where only one or two layers reach, the tint shows through.
        ///
        /// One colour for now. Splitting it by adventure rank needs the rank of the person
        /// the aura belongs to, and the client only knows its own - so that is a byte in the
        /// player spawn packet, not a change to this file.
        /// </remarks>
        private static readonly Color BodyColor = new Color(0.86f, 0.92f, 1.0f);

        /// <summary>
        /// The fringe: pale cyan, for the petals, the halo and every other spike, so the tips
        /// of the burst come out cold where the white gives out.
        /// </summary>
        private static readonly Color FringeColor = new Color(0.50f, 0.78f, 0.92f);

        private static Sprite poolSprite;
        private static Sprite coreSprite;
        private static Sprite haloSprite;
        private static Sprite petalSprite;
        private static Sprite spikeSprite;
        private static Sprite sparkSprite;

        private ServerControllable owner;
        private Transform parts;
        private SpriteRenderer pool;
        private SpriteRenderer core;
        private SpriteRenderer halo;
        private SpriteRenderer[] petals;
        private SpriteRenderer[] spikes;
        private SpriteRenderer[] motes;
        private float petalAngle;
        private float spikeAngle;
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
            aura.petalAngle = Random.value * 360f;
            aura.spikeAngle = Random.value * 360f;
        }

        private void Update()
        {
            if (owner == null)
            {
                if (parts != null)
                    parts.gameObject.SetActive(false);
                return;
            }

            var wanted = owner.Level >= AuraLevel && !owner.IsHidden && !owner.IsHiddenForPerformance;

            if (!wanted)
            {
                if (parts != null && parts.gameObject.activeSelf)
                    parts.gameObject.SetActive(false);
                return;
            }

            if (view == null)
            {
                if (Camera.main == null)
                    return;
                view = Camera.main.transform;
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

            halo = MakePart("Halo", HaloSprite, FringeColor);
            pool = MakePart("Pool", PoolSprite, BodyColor);
            core = MakePart("Core", CoreSprite, BodyColor);

            petals = new SpriteRenderer[PetalCount];
            for (var i = 0; i < PetalCount; i++)
                petals[i] = MakePart("Petal" + i, PetalSprite, FringeColor);

            //white and cold by turns, so the burst is white where they all meet and shades
            //off to blue at the tips, where each one stands alone
            spikes = new SpriteRenderer[SpikeCount];
            for (var i = 0; i < SpikeCount; i++)
                spikes[i] = MakePart("Spike" + i, SpikeSprite, i % 2 == 0 ? BodyColor : FringeColor);

            motes = new SpriteRenderer[MoteCount];
            for (var i = 0; i < MoteCount; i++)
                motes[i] = MakePart("Spark" + i, SparkSprite, BodyColor);
        }

        private SpriteRenderer MakePart(string name, Sprite sprite, Color tint)
        {
            var go = new GameObject(name);
            go.layer = parts.gameObject.layer;
            go.transform.SetParent(parts, false);

            var renderer = go.AddComponent<SpriteRenderer>();
            renderer.sprite = sprite;
            //Behind the character rather than in front of it, so the feet are never covered
            //and the rays come out from behind the body the way the reference has them.
            //Most of that is the material's render queue, which sits just before the
            //character sprites; this is the tie-break within that queue, and it puts the
            //aura under the character's shadow as well, so the shadow reads as a grey
            //oval in the middle of the light the way the reference has it.
            renderer.sortingOrder = -20;

            //no depth test, or the ground in front of the feet clips the bottom off every quad
            var material = GroundItemAura.MaterialFor(tint, true);
            if (material != null)
                renderer.sharedMaterial = material;

            return renderer;
        }

        private void Apply(float t)
        {
            var origin = transform.position;
            var facing = view.rotation;
            var up = facing * Vector3.up;

            //a slow breath, the same one the drop aura uses. The eye is caught by something
            //that moves and annoyed by something that flashes.
            var pulse = 0.5f + 0.5f * Mathf.Sin(t * 2.0f);

            //The pool is a disc on the floor, drawn as a camera-facing ellipse: squashed by
            //about the sine of the camera's pitch, which is what a disc on the floor looks
            //like from that pitch, and squashed a little more than that because the
            //character's own shadow is drawn flatter than true and the pool should agree
            //with it rather than with geometry. The rays are cut to the same ellipse.
            var pitch = Mathf.Abs(view.forward.y);
            var squash = Mathf.Clamp(pitch * 0.75f, 0.30f, 0.60f);

            Place(halo, origin + up * 0.3f, facing, HaloWidth, HaloWidth * 0.8f);
            Paint(halo, 0.12f + pulse * 0.04f);

            Place(pool, origin, facing, PoolWidth, PoolWidth * squash);
            Paint(pool, 0.55f + pulse * 0.12f);

            Place(core, origin + up * 0.1f, facing, CoreWidth, CoreWidth * 0.85f);
            Paint(core, 0.55f + pulse * 0.15f);

            FanPetals(t, origin, facing, up, squash);
            FanSpikes(t, origin, facing, up, squash);
            DriftMotes(t, origin, facing);
        }

        /// <summary>
        /// The petals: a fan of broad soft blades round the feet, each on its own flicker.
        /// </summary>
        /// <remarks>
        /// They live in the plane of the screen, turned about the line of sight, so they
        /// spread out from the feet in every direction on screen and never touch the
        /// ground. Each one breathes on its own beat - eight on the same beat would be a
        /// pinwheel, and eight on different beats are a burst - and the whole fan drifts
        /// round slowly so nothing sits still.
        /// </remarks>
        private void FanPetals(float t, Vector3 origin, Quaternion facing, Vector3 up, float squash)
        {
            if (petals == null)
                return;

            petalAngle = Mathf.Repeat(petalAngle + Time.deltaTime * PetalSpin, 360f);

            for (var i = 0; i < petals.Length; i++)
            {
                var petal = petals[i];
                if (petal == null)
                    continue;

                var flicker = 0.5f + 0.5f * Mathf.Sin(t * (1.3f + 0.21f * i) + i * 1.9f);
                var wobble = Mathf.Sin(t * 0.9f + i * 2.3f) * 6f;
                var angle = petalAngle + i * (360f / PetalCount) + wobble;

                var reach = PetalLength * (0.7f + 0.4f * flicker) * Reach(angle, squash);

                petal.transform.position = origin + up * 0.05f;
                petal.transform.rotation = facing * Quaternion.Euler(0f, 0f, angle);
                SetSize(petal, PetalWidth * (0.75f + 0.35f * flicker), reach);
                Paint(petal, 0.08f + 0.14f * flicker);
            }
        }

        /// <summary>
        /// The spikes: the thin bright rays that make the edge of the burst.
        /// </summary>
        /// <remarks>
        /// Each one breathes a little on its own beat, and no more than a little: the
        /// reference's burst holds its shape, and a version where the spikes lunged in and
        /// out read as a thing flaring rather than a thing standing there. Every other one
        /// is a step shorter, which is where the jagged edge comes from.
        /// </remarks>
        private void FanSpikes(float t, Vector3 origin, Quaternion facing, Vector3 up, float squash)
        {
            if (spikes == null)
                return;

            spikeAngle = Mathf.Repeat(spikeAngle + Time.deltaTime * SpikeSpin, 360f);

            for (var i = 0; i < spikes.Length; i++)
            {
                var spike = spikes[i];
                if (spike == null)
                    continue;

                var flicker = 0.5f + 0.5f * Mathf.Sin(t * (1.7f + 0.23f * i) + i * 2.7f);
                var stagger = i % 2 == 0 ? 1f : SpikeStagger;
                var sway = Mathf.Sin(t * 1.1f + i) * 4f;
                var angle = spikeAngle + i * (360f / SpikeCount) + sway;

                var reach = SpikeLength * stagger * (0.72f + 0.28f * flicker) * Reach(angle, squash);

                spike.transform.position = origin + up * 0.05f;
                spike.transform.rotation = facing * Quaternion.Euler(0f, 0f, angle);
                SetSize(spike, SpikeWidth * (0.8f + 0.3f * flicker), reach);
                Paint(spike, 0.16f + 0.22f * flicker);
            }
        }

        /// <summary>
        /// How far a ray at a given angle on screen is allowed to reach, as a factor.
        /// </summary>
        /// <remarks>
        /// Nought degrees is straight up the screen. The burst lies on the floor, and a
        /// circle on the floor is an ellipse on screen, so a ray is cut to the radius of
        /// that ellipse in its own direction: full length out to the sides, squashed going
        /// up or down the screen. On top of that a ray pointing down the screen is one lying
        /// across the floor toward the camera and is trimmed a little more, and one pointing
        /// up is going away and upward, and gets a little back.
        /// </remarks>
        private static float Reach(float angle, float squash)
        {
            var radians = angle * Mathf.Deg2Rad;
            var upness = Mathf.Cos(radians);
            var sideness = Mathf.Sin(radians);

            var ellipse = 1f / Mathf.Sqrt(sideness * sideness + upness * upness / (squash * squash));
            var bias = upness < 0f ? 1f + 0.2f * upness : 1f + 0.15f * upness;
            return ellipse * bias;
        }

        /// <summary>
        /// Carries the sparks up out of the pool and fades them out on the way.
        /// </summary>
        /// <remarks>
        /// Each one rides its own loop rather than carrying a timer: the fractional part of a
        /// number that only ever grows is a sawtooth from nought to one, and a dozen of them
        /// offset by a twelfth is a steady stream with nothing to keep track of. They rise in
        /// world terms - straight up, off a circle round the feet - and face the camera,
        /// because they are meant to read as sparks in the air rather than as marks on the
        /// floor.
        /// </remarks>
        private void DriftMotes(float t, Vector3 origin, Quaternion facing)
        {
            if (motes == null)
                return;

            for (var i = 0; i < motes.Length; i++)
            {
                var mote = motes[i];
                if (mote == null)
                    continue;

                var life = Mathf.Repeat(t * MoteRise + i / (float)motes.Length, 1f);

                //a slow spiral inward as it climbs, so the column narrows toward the top and
                //the whole thing reads as being drawn up rather than blown about
                var angle = i * 2.1f + life * 1.8f;
                var radius = MoteRadius * (1f - life * 0.4f);

                //and a wander on top of that, on its own beat per spark. Twelve things
                //rising on identical paths read as a machine; the same twelve with a
                //waver in them read as fire.
                var sway = Mathf.Sin(t * 2.6f + i * 1.7f) * MoteSway * life;

                mote.transform.position = origin + new Vector3(
                    Mathf.Cos(angle) * radius + sway,
                    0.1f + life * MoteHeight,
                    Mathf.Sin(angle) * radius);
                mote.transform.rotation = facing;

                //three sizes in rotation, so the column has some depth to it rather than
                //looking like one spark copied twelve times; each one swells as it is born
                //and shrinks away as it dies, and glints on its own beat on the way
                var fade = Mathf.Sin(life * Mathf.PI);
                var twinkle = 0.6f + 0.4f * Mathf.Sin(t * (4f + (i % 4) * 1.3f) + i * 2.1f);
                var width = (0.08f + (i % 3) * 0.035f) * (0.6f + 0.4f * fade);
                SetSize(mote, width, width);
                Paint(mote, fade * twinkle * 0.7f);
            }
        }

        private static void Paint(SpriteRenderer renderer, float amount)
        {
            if (renderer != null)
                renderer.color = new Color(1f, 1f, 1f, amount);
        }

        /// <summary>
        /// Puts a part somewhere, facing the way the camera faces, at a size in world units.
        /// </summary>
        /// <remarks>
        /// Position and rotation are both set in world terms, for the reason the drop aura
        /// sets them that way: the thing this hangs off may carry a billboard that copies
        /// the camera's rotation outright, and a child placed in its parent's terms would
        /// slide about as the camera turned.
        /// </remarks>
        private void Place(SpriteRenderer renderer, Vector3 position, Quaternion facing, float width, float height)
        {
            if (renderer == null)
                return;

            renderer.transform.position = position;
            renderer.transform.rotation = facing;
            SetSize(renderer, width, height);
        }

        /// <summary>
        /// The scale that makes a part come out a given size in world units, each axis on
        /// its own, whatever the texture's resolution and whatever the character is scaled.
        /// </summary>
        /// <remarks>
        /// A player object is built at one and a half, so a width asked for here has to be
        /// divided by that or the pool comes out half again as wide as the number says. Read
        /// off the object rather than written down, because a mounted character is scaled
        /// differently again.
        /// </remarks>
        private void SetSize(SpriteRenderer renderer, float width, float height)
        {
            var sprite = renderer.sprite;
            if (sprite == null)
                return;

            var natural = sprite.bounds.size;
            if (natural.x < 0.0001f || natural.y < 0.0001f)
                return;

            var parentScale = parts.lossyScale.x;
            if (parentScale < 0.0001f)
                parentScale = 1f;

            renderer.transform.localScale = new Vector3(
                width / natural.x / parentScale,
                height / natural.y / parentScale,
                1f);
        }

        /// <summary>
        /// The lit patch of floor: bright across most of the middle, then gone at the edge.
        /// </summary>
        private static Sprite PoolSprite
        {
            get
            {
                if (poolSprite != null)
                    return poolSprite;

                poolSprite = Bake((dx, dy) =>
                {
                    var distance = Mathf.Sqrt(dx * dx + dy * dy);
                    return 1f - Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((distance - 0.3f) / 0.7f));
                }, new Vector2(0.5f, 0.5f));
                return poolSprite;
            }
        }

        /// <summary>The white heart of it, right behind the feet. Small, and the one thing that clips on its own.</summary>
        private static Sprite CoreSprite
        {
            get
            {
                if (coreSprite != null)
                    return coreSprite;

                coreSprite = Bake((dx, dy) =>
                {
                    var distance = Mathf.Sqrt(dx * dx + dy * dy);
                    var soft = Mathf.Clamp01(1f - distance);
                    return soft * soft * soft;
                }, new Vector2(0.5f, 0.5f));
                return coreSprite;
            }
        }

        /// <summary>
        /// The spread: faint, wide, and the thing that makes the rest read as glowing
        /// rather than as painted on.
        /// </summary>
        private static Sprite HaloSprite
        {
            get
            {
                if (haloSprite != null)
                    return haloSprite;

                haloSprite = Bake((dx, dy) =>
                {
                    var distance = Mathf.Sqrt(dx * dx + dy * dy);
                    var soft = Mathf.Clamp01(1f - distance);
                    return Mathf.Pow(soft, 1.5f);
                }, new Vector2(0.5f, 0.5f));
                return haloSprite;
            }
        }

        /// <summary>
        /// A petal: a broad soft blade of light, wide at the foot and tapering, with its
        /// pivot at the foot so it can be turned about the point it comes from.
        /// </summary>
        private static Sprite PetalSprite
        {
            get
            {
                if (petalSprite == null)
                    petalSprite = Blade(0.62f, 1.5f, 1.0f);
                return petalSprite;
            }
        }

        /// <summary>A spike: the same blade drawn thin, with a sharper edge and a longer fade.</summary>
        private static Sprite SpikeSprite
        {
            get
            {
                if (spikeSprite == null)
                    spikeSprite = Blade(0.85f, 2.0f, 1.4f);
                return spikeSprite;
            }
        }

        /// <summary>
        /// One blade of light, pivot at the foot: wide there, coming to a point at the tip.
        /// </summary>
        /// <remarks>
        /// Taper is how much of the width is gone by the tip, edge is how hard the sides
        /// fall off, and fade is how quickly it dims along its length. It fades in over the
        /// first tenth of its length rather than starting at full strength, so a score of
        /// them meeting at the same point make a soft heart there and not a hard-edged star.
        /// </remarks>
        private static Sprite Blade(float taper, float edge, float fade)
        {
            return Bake((dx, dy) =>
            {
                //along runs nought at the foot to one at the tip, across minus one to one
                var along = (dy + 1f) * 0.5f;
                var across = dx;

                var half = 1f - taper * along;
                var side = Mathf.Pow(Mathf.Clamp01(1f - Mathf.Abs(across) / Mathf.Max(half, 0.04f)), edge);
                var length = Mathf.Pow(Mathf.Clamp01(1f - along), fade);
                var foot = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(along / 0.12f));

                return side * length * foot;
            }, new Vector2(0.5f, 0f));
        }

        /// <summary>A spark: a soft dot with the faintest four-pointed star through it.</summary>
        private static Sprite SparkSprite
        {
            get
            {
                if (sparkSprite != null)
                    return sparkSprite;

                sparkSprite = Bake((dx, dy) =>
                {
                    var distance = Mathf.Sqrt(dx * dx + dy * dy);
                    var soft = Mathf.Clamp01(1f - distance);
                    var dot = soft * soft * soft;

                    var angle = Mathf.Atan2(dy, dx);
                    var star = soft * Mathf.Pow(Mathf.Abs(Mathf.Cos(angle * 2f)), 8f) * 0.7f;

                    return Mathf.Max(dot, star);
                }, new Vector2(0.5f, 0.5f));
                return sparkSprite;
            }
        }

        /// <summary>
        /// Builds one of the textures above from a function of position, given as a pair of
        /// coordinates each running minus one to one across the texture.
        /// </summary>
        /// <remarks>
        /// Every one of these fills its texture out to the edge, which is the whole reason
        /// they are drawn here instead of borrowed: a width asked for is then the width that
        /// appears, with no invisible margin to swallow it.
        /// </remarks>
        private static Sprite Bake(System.Func<float, float, float> shape, Vector2 pivot)
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

                    var alpha = Mathf.Clamp01(shape(dx, dy));
                    texture.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, Size, Size), pivot, 100);
        }
    }
}
