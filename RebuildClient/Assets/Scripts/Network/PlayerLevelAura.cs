using UnityEngine;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// The light at the feet of a character who has reached the level cap: four white
    /// waves standing round the boots, each brighter and thicker than the one inside it,
    /// throwing sparks, with a flare of soft rays off the outermost.
    /// </summary>
    /// <remarks>
    /// Drawn here rather than imported. The aura is a standard thing to have and the obvious
    /// move was to reach for it in the effect table, but there is no aura in there - the
    /// hundred and forty odd effects the client knows are all skills, and every one of them
    /// plays once and finishes. This has to sit under somebody for as long as they stand
    /// there, which is the same problem the drop aura solved, so it is solved the same way.
    ///
    /// Every part of it faces the camera. The first version lay flat on the floor, the way a
    /// ground decal would, and on any slope the flat quad cut through the ground, so half of
    /// it vanished the moment the character walked over a change in level. A camera-facing
    /// quad cannot intersect the terrain however the terrain is shaped, so the waves are
    /// drawn as ellipses squashed by the camera's pitch, which is what a ring on the floor
    /// looks like from that pitch.
    ///
    /// The quads still dip below the ground plane on the side nearest the camera, which is
    /// why they are drawn without a depth test at all: with one, the terrain in front would
    /// clip the lower half of every wave off. Nothing here writes depth, and everything is
    /// drawn in the queue before the character sprites, so the feet stay visible and the
    /// ground never wins. The queue rather than the sorting order, because the first
    /// version sat one queue after the sprites with a sorting order below them and painted
    /// straight over the feet: between queues the order is not consulted at all.
    ///
    /// The waves run faint to bright from the inside out on purpose. The innermost is a
    /// thread just outside the boots, so the boots are what you see; the outermost is a
    /// thick band that clips to solid white, so from across a field the character is a
    /// white circle with somebody standing in it. Each wave throws sparks in proportion,
    /// and the flare of rays comes off the outer one.
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
        /// The waves, inside out. Radius on the floor in world units - a character stands
        /// about a unit and a half, and a mounted one is about that wide - then how thick
        /// each is as a fraction of the texture, how bright it is, and how many sparks it
        /// throws. All four run the same way: the inner wave is thin, faint and quiet, the
        /// outer one is thick, at full white, and busy.
        /// </summary>
        private static readonly float[] WaveRadius = { 0.50f, 0.85f, 1.20f, 1.55f };
        private static readonly float[] WaveBand = { 0.04f, 0.06f, 0.09f, 0.13f };
        private static readonly float[] WaveStrength = { 0.28f, 0.50f, 0.75f, 1.00f };
        private static readonly int[] WaveSparks = { 3, 5, 7, 11 };

        /// <summary>Where in its own texture a wave is drawn, as a fraction of the radius.</summary>
        private const float WaveEdge = 0.85f;

        /// <summary>
        /// The waves swell outward one after another, which is what makes them read as
        /// waves rather than as four painted circles. Speed in radians a second, depth as a
        /// fraction of radius.
        /// </summary>
        private const float RippleSpeed = 1.6f;
        private const float RippleDepth = 0.05f;

        private const float HaloWidth = 4.2f;

        /// <summary>
        /// The rays off the outer wave come in two kinds, because the reference has two
        /// kinds in it: broad soft petals that make the burst, and thin bright spikes that
        /// shoot out of it. Petals alone were a cloud and spikes alone were a pinwheel;
        /// together they are a flare.
        /// </summary>
        private const int PetalCount = 10;
        private const int SpikeCount = 12;

        /// <summary>How far each kind reaches from the centre at full stretch, in world units.</summary>
        private const float PetalLength = 2.0f;
        private const float SpikeLength = 2.5f;

        /// <summary>How wide each kind is at its foot, in world units.</summary>
        private const float PetalWidth = 1.5f;
        private const float SpikeWidth = 0.45f;

        /// <summary>
        /// Degrees a second each fan turns. Slow, and against each other: two fans turning
        /// the same way would lock into a single wheel, and the rays are meant to cross.
        /// </summary>
        private const float PetalSpin = 8f;
        private const float SpikeSpin = -5f;

        /// <summary>Loops a second a spark makes - about three seconds from its wave to gone.</summary>
        private const float SparkRise = 0.3f;

        /// <summary>How far a spark wanders sideways on the way up, in world units.</summary>
        private const float SparkSway = 0.22f;

        private const int Size = 160;

        /// <summary>
        /// The body of the light: white, with just enough blue left in it to read as light
        /// rather than as paper.
        /// </summary>
        /// <remarks>
        /// Written darker than it should look, like every colour in the drop aura and for the
        /// same reason: these are additive layers, so what reaches the screen is the tint
        /// times however many of them cover the pixel. The outer wave is the exception and
        /// is pure white at full strength - it is meant to clip, that is what "full" means.
        ///
        /// One colour for now. Splitting it by adventure rank needs the rank of the person
        /// the aura belongs to, and the client only knows its own - so that is a byte in the
        /// player spawn packet, not a change to this file.
        /// </remarks>
        private static readonly Color BodyColor = new Color(0.86f, 0.92f, 1.0f);

        /// <summary>The fringe: pale cyan, for the rays and the halo, where the white gives out.</summary>
        private static readonly Color FringeColor = new Color(0.50f, 0.78f, 0.92f);

        private static readonly Sprite[] waveSprites = new Sprite[4];
        private static Sprite haloSprite;
        private static Sprite petalSprite;
        private static Sprite spikeSprite;
        private static Sprite sparkSprite;

        private ServerControllable owner;
        private Transform parts;
        private SpriteRenderer halo;
        private SpriteRenderer[] waves;
        private SpriteRenderer[] petals;
        private SpriteRenderer[] spikes;
        private SpriteRenderer[] sparks;

        /// <summary>Which wave each spark belongs to, so it rises from that radius at that strength.</summary>
        private int[] sparkWave;

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

            //inside out, the outer one in plain white so that at full strength it is white
            //and not the blue-tinged white the rest are
            waves = new SpriteRenderer[WaveRadius.Length];
            for (var i = 0; i < waves.Length; i++)
                waves[i] = MakePart("Wave" + i, WaveSprite(i), i == waves.Length - 1 ? Color.white : BodyColor);

            petals = new SpriteRenderer[PetalCount];
            for (var i = 0; i < PetalCount; i++)
                petals[i] = MakePart("Petal" + i, PetalSprite, FringeColor);

            spikes = new SpriteRenderer[SpikeCount];
            for (var i = 0; i < SpikeCount; i++)
                spikes[i] = MakePart("Spike" + i, SpikeSprite, BodyColor);

            var total = 0;
            foreach (var count in WaveSparks)
                total += count;

            sparks = new SpriteRenderer[total];
            sparkWave = new int[total];
            var k = 0;
            for (var wave = 0; wave < WaveSparks.Length; wave++)
            {
                for (var i = 0; i < WaveSparks[wave]; i++)
                {
                    sparks[k] = MakePart("Spark" + k, SparkSprite, BodyColor);
                    sparkWave[k] = wave;
                    k++;
                }
            }
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

            //A wave is a ring on the floor, drawn as a camera-facing ellipse: squashed by
            //about the sine of the camera's pitch, which is what a ring on the floor looks
            //like from that pitch, and squashed a little more than that because the
            //character's own shadow is drawn flatter than true and the waves should agree
            //with it rather than with geometry.
            var pitch = Mathf.Abs(view.forward.y);
            var squash = Mathf.Clamp(pitch * 0.75f, 0.30f, 0.60f);

            Place(halo, origin + up * 0.35f, facing, HaloWidth, HaloWidth * 0.8f);
            Paint(halo, 0.10f + pulse * 0.04f);

            if (waves != null)
            {
                for (var i = 0; i < waves.Length; i++)
                {
                    //each wave a little behind the one inside it, so the swell travels out
                    var ripple = 1f + RippleDepth * Mathf.Sin(t * RippleSpeed - i * 0.9f);
                    var width = WaveRadius[i] * 2f / WaveEdge * ripple;

                    Place(waves[i], origin, facing, width, width * squash);
                    Paint(waves[i], WaveStrength[i] * (0.92f + 0.08f * Mathf.Sin(t * 2.0f - i * 0.9f)));
                }
            }

            FanPetals(t, origin, facing, up);
            FanSpikes(t, origin, facing, up);
            DriftSparks(t, origin, facing);
        }

        /// <summary>
        /// The petals: a fan of broad soft blades off the outer wave, each on its own flicker.
        /// </summary>
        /// <remarks>
        /// They live in the plane of the screen, turned about the line of sight, so they
        /// spread out from the feet in every direction on screen and never touch the
        /// ground. A ray pointing down the screen is one pointing at the camera across the
        /// floor in front of the feet, and it is shortened for it; one pointing up is going
        /// away and upward, and gets a little extra. Each one breathes on its own beat -
        /// ten on the same beat would be a pinwheel, and ten on different beats are a
        /// flare - and the whole fan drifts round slowly so nothing sits still.
        /// </remarks>
        private void FanPetals(float t, Vector3 origin, Quaternion facing, Vector3 up)
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

                var reach = PetalLength * (0.6f + 0.5f * flicker) * Reach(angle);

                petal.transform.position = origin + up * 0.05f;
                petal.transform.rotation = facing * Quaternion.Euler(0f, 0f, angle);
                SetSize(petal, PetalWidth * (0.7f + 0.4f * flicker), reach);
                Paint(petal, 0.09f + 0.16f * flicker);
            }
        }

        /// <summary>
        /// The spikes: thin bright rays that shoot out through the petals and pull back.
        /// </summary>
        /// <remarks>
        /// Their flicker is squared, so each one spends most of its time short and dim and
        /// then lunges out for a moment. That is what the reference does - a few long
        /// streaks at any instant, never the same ones twice - and it is what makes the
        /// thing look alive rather than lit.
        /// </remarks>
        private void FanSpikes(float t, Vector3 origin, Quaternion facing, Vector3 up)
        {
            if (spikes == null)
                return;

            spikeAngle = Mathf.Repeat(spikeAngle + Time.deltaTime * SpikeSpin, 360f);

            for (var i = 0; i < spikes.Length; i++)
            {
                var spike = spikes[i];
                if (spike == null)
                    continue;

                var flicker = 0.5f + 0.5f * Mathf.Sin(t * (2.3f + 0.31f * i) + i * 2.7f);
                flicker *= flicker;
                var sway = Mathf.Sin(t * 1.3f + i) * 9f;
                var angle = spikeAngle + i * (360f / SpikeCount) + sway;

                var reach = SpikeLength * (0.4f + 0.6f * flicker) * Reach(angle);

                spike.transform.position = origin + up * 0.05f;
                spike.transform.rotation = facing * Quaternion.Euler(0f, 0f, angle);
                SetSize(spike, SpikeWidth * (0.6f + 0.5f * flicker), reach);
                Paint(spike, 0.10f + 0.35f * flicker);
            }
        }

        /// <summary>
        /// How far a ray at a given angle on screen is allowed to reach, as a factor.
        /// </summary>
        /// <remarks>
        /// Nought degrees is straight up the screen. A ray pointing down the screen is one
        /// lying across the floor toward the camera, and it is cut to about half; one
        /// pointing up is going away and upward, and gets a little extra.
        /// </remarks>
        private static float Reach(float angle)
        {
            var upness = Mathf.Cos(angle * Mathf.Deg2Rad);
            return upness < 0f ? 1f + 0.5f * upness : 1f + 0.25f * upness;
        }

        /// <summary>
        /// Carries the sparks up and out from their waves and fades them out on the way.
        /// </summary>
        /// <remarks>
        /// Each spark belongs to one wave and takes that wave's measure: it is born on that
        /// wave's circle, and the stronger the wave the higher it climbs, the further out it
        /// drifts, the bigger and the brighter it is. So the inner thread lets go of a few
        /// dim specks and the outer band boils. Each one rides its own loop rather than
        /// carrying a timer: the fractional part of a number that only ever grows is a
        /// sawtooth from nought to one, and a couple of dozen of them offset by a share each
        /// is a steady stream with nothing to keep track of.
        /// </remarks>
        private void DriftSparks(float t, Vector3 origin, Quaternion facing)
        {
            if (sparks == null)
                return;

            for (var k = 0; k < sparks.Length; k++)
            {
                var spark = sparks[k];
                if (spark == null)
                    continue;

                var wave = sparkWave[k];
                var strength = WaveStrength[wave];

                var life = Mathf.Repeat(t * SparkRise + k / (float)sparks.Length, 1f);

                //out from the wave as it climbs, further the stronger the wave, so the light
                //is thrown outward rather than straight up
                var angle = k * 2.1f + life * 1.2f;
                var radius = WaveRadius[wave] * (1f + life * (0.15f + 0.35f * strength));
                var sway = Mathf.Sin(t * 2.6f + k * 1.7f) * SparkSway * life;
                var height = 0.1f + life * (0.9f + 2.0f * strength);

                spark.transform.position = origin + new Vector3(
                    Mathf.Cos(angle) * radius + sway,
                    height,
                    Mathf.Sin(angle) * radius);
                spark.transform.rotation = facing;

                //three sizes in rotation, so the column has some depth to it rather than
                //looking like one spark copied over; each swells as it is born and shrinks
                //away as it dies
                var fade = Mathf.Sin(life * Mathf.PI);
                var width = (0.06f + 0.06f * strength + (k % 3) * 0.03f) * (0.6f + 0.4f * fade);
                SetSize(spark, width, width);
                Paint(spark, fade * (0.30f + 0.50f * strength));
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
        /// divided by that or the wave comes out half again as wide as the number says. Read
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
        /// One wave: a soft ring drawn near the edge of its texture, as thick as its entry
        /// in the table says. Soft on both sides, so four of them at four sizes read as
        /// light and not as four drawn lines.
        /// </summary>
        private static Sprite WaveSprite(int index)
        {
            if (waveSprites[index] != null)
                return waveSprites[index];

            var band = WaveBand[index];
            waveSprites[index] = Bake((dx, dy) =>
            {
                var distance = Mathf.Sqrt(dx * dx + dy * dy);
                var soft = Mathf.Clamp01(1f - Mathf.Abs(distance - WaveEdge) / band);
                return Mathf.Pow(soft, 1.5f);
            }, new Vector2(0.5f, 0.5f));
            return waveSprites[index];
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
        /// first tenth of its length rather than starting at full strength, so a dozen of
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
