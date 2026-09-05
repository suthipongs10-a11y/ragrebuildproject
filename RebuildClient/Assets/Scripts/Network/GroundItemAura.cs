using System.Collections.Generic;
using Assets.Scripts.Effects;
using RebuildSharedData.ClientTypes;
using RebuildSharedData.Enum;
using UnityEngine;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// The pillar of light over something worth picking up.
    ///
    /// A card and a jellopy land on the floor looking exactly alike, and on a map with
    /// twenty things on the ground the good one goes unnoticed. A beam is what makes it
    /// visible from across the screen — the first attempt was a halo behind the icon,
    /// which was both smaller than the icon and behind it, so it was never seen at all.
    ///
    /// What glows is decided here rather than on the server, because the client already
    /// holds the item's class and code. The two things it cannot know — how unlikely the
    /// drop was, and whether a boss dropped it — are what the server sends.
    /// </summary>
    public class GroundItemAura : MonoBehaviour
    {
        //Colour says where it came from, at a glance and without reading anything:
        //  gold   a card
        //  red    a card off a boss or an MVP
        //  blue   gear off an ordinary monster
        //  purple gear off a boss
        //  ore    the colour of the ore
        //
        //Every one of these is darker than the colour it is meant to look like, and that is
        //the point. Additive light adds and then clips, so what reaches the screen is the
        //tint times however many layers cover that pixel — and once the strongest channel
        //clips at one, only the channels that did not clip still carry any hue. The old blue
        //had a green of 0.48; three layers took it past one and it landed on exactly cyan.
        //The old purple landed on exactly magenta the same way. Written at roughly the
        //brightness the layers will multiply them back up to, they land where they should.
        private static readonly Color CardColor = new Color(1.00f, 0.52f, 0.02f);
        private static readonly Color BossCardColor = new Color(1.00f, 0.06f, 0.02f);
        private static readonly Color GearColor = new Color(0.05f, 0.30f, 1.00f);
        private static readonly Color BossGearColor = new Color(0.45f, 0.05f, 1.00f);

        private static readonly Dictionary<string, Color> OreColors = new Dictionary<string, Color>
        {
            { "Oridecon", new Color(1.00f, 0.22f, 0.01f) },
            { "Rough_Oridecon", new Color(0.85f, 0.20f, 0.03f) },
            //the one colour here that is meant to be cyan, rather than a blue that became one
            { "Elunium", new Color(0.10f, 0.62f, 1.00f) },
            { "Rough_Elunium", new Color(0.14f, 0.55f, 0.90f) },
            { "Phracon", new Color(0.75f, 0.26f, 0.04f) },
            { "Emveretarcon", new Color(0.06f, 0.85f, 0.16f) },
            { "Gold", new Color(1.00f, 0.62f, 0.02f) },
            { "Steel", new Color(0.40f, 0.52f, 0.75f) },
        };

        //the two worth stopping for whatever the odds were on this particular monster
        private static readonly HashSet<string> AlwaysLitOre = new HashSet<string> { "Oridecon", "Elunium" };

        private const int BeamWidth = 32;
        private const int BeamHeight = 256;
        private const int GlowSize = 64;
        private const int RingSize = 128;

        /// <summary>The cast-target decal, which is already a ring drawn to be tinted.</summary>
        private const string RingTexture = "magic_target_grey";

        /// <summary>Degrees a second. Fast enough to read as turning, slow enough not to spin.</summary>
        private const float RingSpin = 45f;

        /// <summary>Arms swept round the swirl. Six reads as motion; two reads as a bowtie.</summary>
        private const int SwirlArms = 6;

        /// <summary>
        /// How much bigger the grand aura is than the ordinary one.
        ///
        /// The game's own effects were tried for this and none of them fit: every one of the
        /// hundred odd imported effects plays on a character, not on a thing lying on the
        /// floor. What was wanted was this aura, larger - so it is this aura, larger.
        ///
        /// Reserved for cards and for what a boss left behind. A shaft this size over every
        /// jellopy is a shaft over nothing.
        /// </summary>
        /// Height is the cheaper half of this: the ordinary shaft already runs off the top of
        /// the screen, so more of it is more of something nobody can see. Width is what reads
        /// from across a map, and the foot of it is what says where the thing actually is.
        private const float GrandHeight = 1.7f;

        private const float GrandWidth = 1.3f;

        /// <summary>
        /// Everything, twice over. The sizes below were measured against the item icon and
        /// looked right in the editor, and then in play - on a real map, at the distance
        /// the camera actually sits - the shaft read as a candle. This is one number rather
        /// than every width and height rewritten, so the proportions that were measured
        /// stay measured.
        /// </summary>
        private const float SizeScale = 2f;

        /// <summary>
        /// Specks of light drifting up the shaft, which is what the ordinary aura has none of
        /// and what makes the difference between a lit column and something happening.
        /// </summary>
        private const int MoteCount = 8;

        private const float MoteRise = 0.55f;

        private const float MoteSpread = 0.42f;

        /// <summary>
        /// The item sits a fifth of a unit off the floor, so the ring has to come back down
        /// by about that much to lie on it rather than through the middle of the icon.
        /// </summary>
        private const float RingLift = -0.18f;

        private static Sprite beamSprite;
        private static Sprite glowSprite;
        private static Sprite ringSprite;
        private static Sprite swirlSprite;
        private static bool ringResourceMissing;
        //One material per colour rather than one shared by all of them. The colour has to
        //travel in the material's own Tint property: it is the only one of the shader's two
        //colour inputs that is certain to arrive, and the beams coming out white is what a
        //tint that did not arrive looks like.
        private static readonly Dictionary<Color, Material> additiveMaterials = new Dictionary<Color, Material>();
        private static readonly Dictionary<Color, Material> additiveMaterialsNoDepth = new Dictionary<Color, Material>();
        private static bool loggedOnce;

        /// <summary>The second ring, turning the other way, and the rising specks.</summary>
        private SpriteRenderer halo;

        private SpriteRenderer[] motes;

        /// <summary>Each ring turns on its own angle, so the two do not share a number.</summary>
        private float haloAngle;

        /// <summary>Whether this drop earned the larger aura.</summary>
        private bool grand;

        private SpriteRenderer beam;
        private SpriteRenderer core;
        private SpriteRenderer glow;
        private SpriteRenderer ring;
        private Color tint;
        private float strength;
        private float phase;
        private float ringAngle;

        /// <summary>The height the pulse swings around, fixed when the beam is built.</summary>
        private float beamHeight = 1f;

        /// <summary>
        /// Puts a light on a dropped item, or does not. Returns quietly for everything
        /// ordinary, which is nearly everything: a beam on every drop is the same as a beam
        /// on none.
        /// </summary>
        public static void TryAttach(GameObject parent, ItemData data, int rarity, bool fromBoss)
        {
            if (parent == null || data == null)
                return;

            if (!Classify(data, rarity, fromBoss, out var color, out var tier))
                return;

            var isCard = data.ItemClass == ItemClass.Card;
            var isGear = data.ItemClass == ItemClass.Weapon || data.ItemClass == ItemClass.Equipment;

            var go = new GameObject("Aura");
            go.layer = parent.layer;
            go.transform.SetParent(parent.transform, false);

            var aura = go.AddComponent<GroundItemAura>();
            //A card, and anything wearable. Gear used to have to come off a boss to earn
            //this, which left an ordinary piece of gear with the small aura and made the two
            //look like different features rather than the same one at different weights.
            //A card and a sword are both worth crossing a map for, so they get the same
            //aura and the colour is what says which is which.
            aura.grand = data.ItemClass == ItemClass.Card
                         || data.ItemClass == ItemClass.Weapon
                         || data.ItemClass == ItemClass.Equipment;

            var tall = (aura.grand ? GrandHeight : 1f) * SizeScale;
            var wide = (aura.grand ? GrandWidth : 1f) * SizeScale;

            aura.tint = color;
            aura.strength = 0.72f + tier * 0.06f;
            //so a field of drops does not pulse in lockstep
            aura.phase = Random.value * 10f;

            //Two shafts of the same colour, one inside the other, and no white one. A white
            //shaft fills every channel by itself, and adding it to anything gives white —
            //which is exactly what four stacked layers produced. Two passes of a saturated
            //tint fill the strong channels and leave the weak one weak, so the beam is very
            //bright and still gold, or blue, or purple.
            //
            //The widths below are measured against the item icon rather than chosen, because
            //the icon is the one thing that appears in both this game and the recording they
            //were taken from. There the shaft is about half the width of the icon it stands
            //on and the circle about three and a half times it: a thin bright line inside a
            //broad turning ring, where the ring is what catches the eye from across a map
            //and the line is what says which square the thing is actually on.
            //
            //They had been the other way round - a shaft several times wider than the item
            //with a thin ring lost inside it - and at that width there is no shape left to
            //read, only a colour. The scale numbers are multipliers on the sprite's own
            //size, and the beam sprite is 32 pixels at a hundred to the unit, so 0.32 units:
            //a scale of one is already about half an icon.
            aura.beamHeight = (3.6f + tier * 0.6f) * tall;
            aura.beam = MakeRenderer(go.transform, "Beam", BeamSprite, Vector3.zero, color);
            aura.beam.transform.localScale = new Vector3((1.15f + tier * 0.12f) * wide, aura.beamHeight, 1f);

            //The same tint as the shaft around it, not a paler one. Mixing white into the
            //core was a second push toward white on top of the one the stacking already
            //gives, and it is the middle of the beam — the part you actually read the
            //colour off — that it bleached.
            aura.core = MakeRenderer(go.transform, "Core", BeamSprite, Vector3.zero, color);
            aura.core.transform.localScale = new Vector3((0.45f + tier * 0.05f) * wide, aura.beamHeight * 0.9f, 1f);

            //a pool of light where it is actually lying, so the eye is sent to the item and
            //not to the empty air above it
            aura.glow = MakeRenderer(go.transform, "Glow", GlowSprite, new Vector3(0, 0.05f, 0), color);
            aura.glow.transform.localScale = Vector3.one * ((1.5f + tier * 0.2f) * wide);

            //A ring drawn on the floor around it, turning slowly. Everything else here faces
            //the camera; this is the one part that lies in the world, and that is what makes
            //it read as a circle around the item rather than a disc behind it.
            aura.ring = MakeRenderer(go.transform, "Ring", RingSprite, Vector3.zero, color);
            if (aura.ring != null)
                aura.ring.transform.localScale = ScaleFor(aura.ring.sprite, (1.55f + tier * 0.18f) * wide);

            if (aura.grand)
                aura.BuildGrandParts(go.transform, color, tier, wide);

            aura.Apply(0f);
        }

        /// <summary>
        /// The two things the ordinary aura does not have: a wider ring turning against the
        /// first, and specks of light drifting up the shaft.
        ///
        /// Both are what separate a lit column from something happening. A single ring at one
        /// speed reads as a decal; two at different speeds read as motion, and anything that
        /// rises is read as rising even when it is eight quads on a sine.
        /// </summary>
        private void BuildGrandParts(Transform parent, Color color, int tier, float wide)
        {
            //A broad swirling band just outside the crisp ring, turning the other way. The
            //ring says where the circle is; this is what makes the circle look like it is
            //moving, and it is the part of the reference that reads as an aura rather than
            //as a decal somebody rotated.
            halo = MakeRenderer(parent, "Halo", SwirlSprite, Vector3.zero, color);
            if (halo != null)
                halo.transform.localScale = ScaleFor(halo.sprite, (2.05f + tier * 0.2f) * wide);

            motes = new SpriteRenderer[MoteCount];
            for (var i = 0; i < MoteCount; i++)
            {
                var mote = MakeRenderer(parent, "Mote" + i, GlowSprite, Vector3.zero, color);
                //Each one a different size, so the column has some depth to it rather than
                //looking like one speck copied eight times.
                mote.transform.localScale = Vector3.one * (0.35f + (i % 3) * 0.16f) * SizeScale;
                motes[i] = mote;
            }
        }

        /// <summary>
        /// Moves the specks up the shaft and fades them out as they go.
        ///
        /// Each one is on its own loop rather than on a timer of its own: the fractional part
        /// of a number that only ever grows is a sawtooth from nought to one, and eight of
        /// them offset by an eighth is a steady stream with nothing to keep track of.
        /// </summary>
        private void DriftMotes(float t)
        {
            if (motes == null)
                return;

            for (var i = 0; i < motes.Length; i++)
            {
                var mote = motes[i];
                if (mote == null)
                    continue;

                var life = Mathf.Repeat(t * MoteRise + i / (float)motes.Length, 1f);

                //a slow spiral rather than a straight line up, which reads as being drawn
                //upward rather than as falling upward
                var angle = (i * 2.4f) + life * 3.1f;
                var radius = MoteSpread * SizeScale * (1f - life * 0.35f);

                mote.transform.localPosition = new Vector3(
                    Mathf.Cos(angle) * radius,
                    life * beamHeight * 0.82f,
                    Mathf.Sin(angle) * radius);

                //brightest in the middle of the climb: born out of nothing at the foot and
                //gone before the top, so the shaft has no hard end to it
                var fade = Mathf.Sin(life * Mathf.PI);
                mote.color = new Color(1f, 1f, 1f, strength * fade * 0.85f);
            }
        }

        private static SpriteRenderer MakeRenderer(Transform parent, string name, Sprite sprite, Vector3 offset,
            Color tint)
        {
            var go = new GameObject(name);
            go.layer = parent.gameObject.layer;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = offset;

            var renderer = go.AddComponent<SpriteRenderer>();
            renderer.sprite = sprite;
            //behind the icon, so the item reads on top of its own light
            renderer.sortingOrder = -1;

            var material = MaterialFor(tint);
            if (material != null)
                renderer.sharedMaterial = material;

            return renderer;
        }

        /// <summary>
        /// The whole rule, in one place.
        /// </summary>
        private static bool Classify(ItemData data, int rarity, bool fromBoss, out Color color, out int tier)
        {
            color = default;
            tier = fromBoss ? Mathf.Max(rarity, 3) : rarity;

            if (data.ItemClass == ItemClass.Card)
            {
                //a card is never an ordinary drop, whatever band the roll fell in — some
                //arrive by routes where there was no roll at all
                color = fromBoss ? BossCardColor : CardColor;
                tier = Mathf.Max(tier, 2);
                return true;
            }

            if (!string.IsNullOrEmpty(data.Code) && OreColors.TryGetValue(data.Code, out var oreColor))
            {
                if (!AlwaysLitOre.Contains(data.Code) && rarity < 1 && !fromBoss)
                    return false;

                color = oreColor;
                tier = Mathf.Max(tier, 1);
                return true;
            }

            if (data.ItemClass == ItemClass.Weapon || data.ItemClass == ItemClass.Equipment)
            {
                //Everything wearable is lit. The rarity gate that used to be here meant a
                //piece of gear off an ordinary monster usually had no light at all, which
                //read as the feature being broken rather than as the drop being ordinary.
                //
                //Floored at the same tier a card gets, so the two come out the same size.
                //How unlikely the drop was still lifts it above that floor, so a rare piece
                //still stands taller than a common one.
                color = fromBoss ? BossGearColor : GearColor;
                tier = Mathf.Max(tier, 2);
                return true;
            }

            return false;
        }

        private void Update()
        {
            Apply(Time.time + phase);
        }

        private void Apply(float t)
        {
            //a slow breath rather than a blink: the eye is caught by something that moves
            //and annoyed by something that flashes
            var pulse = 0.5f + 0.5f * Mathf.Sin(t * 2.4f);

            //One layer carries the light and the others only lift it.
            //
            //Three layers at nearly full alpha was the mistake: they add to almost three
            //times the tint, every channel clips, and what is left is white with a hint of
            //whichever channel started lowest. The wide shaft is the one that has to be
            //bright, because it is nearly all of what you see; the core adds a hotter line
            //down the middle and the pool lifts the foot. Together they come to about one
            //and a quarter, which is enough to clip the strongest channel — a bright beam —
            //and not enough to clip the second, which is what keeps the colour.
            Paint(beam, 0.90f + pulse * 0.10f);
            Paint(core, 0.30f + pulse * 0.12f);
            Paint(glow, 0.38f + pulse * 0.12f);
            //brighter than the rest because it is a thin line rather than a filled shape, and
            //it barely overlaps the shaft, so it has almost nothing stacked underneath it
            Paint(ring, 0.80f + pulse * 0.20f);

            Stretch(beam, beamHeight, pulse);
            Stretch(core, beamHeight * 0.9f, pulse);
            LayOnGround(ring, ref ringAngle);

            if (!grand)
                return;

            //the second ring turns against the first, so the two never line up and the pair
            //reads as one turning thing rather than as two copies of a decal
            Paint(halo, 0.55f + pulse * 0.25f);
            LayOnGround(halo, ref haloAngle, -0.6f);
            DriftMotes(t);
        }

        /// <summary>
        /// Keeps the ring flat on the floor and turning, whatever the rest of the object is
        /// doing.
        ///
        /// Position and rotation are both set in world terms on purpose. The item this hangs
        /// off carries a billboard, and that billboard copies the camera's rotation outright
        /// — pitch as well as yaw — so under it there is no such thing as "up" or "level".
        /// A child asked to lie flat in the parent's terms would tilt with the camera and a
        /// child offset downward would slide sideways as the camera turned.
        /// </summary>
        /// <summary>
        /// Lays a ring flat on the floor around the item and turns it.
        ///
        /// Each ring keeps its own angle. They used to share one, and with two rings on it
        /// the shared number was advanced twice a frame and read back between the two writes
        /// - so instead of turning against each other at different rates they crept round
        /// together at a rate that was neither.
        /// </summary>
        private void LayOnGround(SpriteRenderer renderer, ref float angle, float speed = 1f)
        {
            if (renderer == null)
                return;

            angle = Mathf.Repeat(angle + Time.deltaTime * RingSpin * speed, 360f);

            renderer.transform.position = transform.position + new Vector3(0, RingLift, 0);
            renderer.transform.rotation = Quaternion.Euler(90f, angle, 0f);
        }

        /// <summary>
        /// The scale that makes a sprite come out a given number of units across, whatever
        /// the texture's own resolution and pixels-per-unit turn out to be.
        /// </summary>
        internal static Vector3 ScaleFor(Sprite sprite, float width)
        {
            if (sprite == null)
                return Vector3.one;

            var natural = sprite.bounds.size.x;
            return natural > 0.0001f ? Vector3.one * (width / natural) : Vector3.one;
        }

        /// <summary>
        /// Sets how bright a shaft is this frame, and only that.
        ///
        /// White with a varying alpha, because the hue is in the material now. The shader
        /// multiplies the two together, so this scales the light without touching its
        /// colour — and if the vertex colour turns out not to reach the shader at all, the
        /// beam simply stops breathing instead of going white.
        /// </summary>
        private void Paint(SpriteRenderer renderer, float amount)
        {
            if (renderer == null)
                return;

            renderer.color = new Color(1f, 1f, 1f, strength * amount);
        }

        private static void Stretch(SpriteRenderer renderer, float height, float pulse)
        {
            if (renderer == null)
                return;

            var scale = renderer.transform.localScale;
            scale.y = height * (0.94f + pulse * 0.12f);
            renderer.transform.localScale = scale;
        }

        /// <summary>
        /// An additive material carrying one particular colour.
        ///
        /// Additive is the blend that lets light behave like light: alpha blending cannot go
        /// brighter than the colour it paints with, which is why turning the old beam up
        /// three times changed nothing. This is the same shader every skill effect in the
        /// client already uses.
        ///
        /// One material per colour, kept for the life of the session. There are about a
        /// dozen colours in this file and drops are short lived, so the cache never grows.
        /// </summary>
        internal static Material MaterialFor(Color tint)
        {
            return MaterialFor(tint, false);
        }

        /// <summary>
        /// The same, with the choice of skipping the depth test.
        ///
        /// A camera-facing quad at somebody's feet dips below the floor on the side nearest
        /// the camera, and with a depth test the ground clips that half off. The level aura
        /// asks for this; the drop beams do not, because a beam that showed through walls
        /// would give away drops in the next room.
        /// </summary>
        internal static Material MaterialFor(Color tint, bool ignoreDepth)
        {
            var materials = ignoreDepth ? additiveMaterialsNoDepth : additiveMaterials;
            if (materials.TryGetValue(tint, out var found) && found != null)
                return found;

            var cache = ShaderCache.Instance;
            if (cache == null || cache.AdditiveShader == null)
            {
                if (!loggedOnce)
                {
                    loggedOnce = true;
                    Debug.LogWarning("[GroundItemAura] No additive shader available, so drop beams "
                                     + "will be drawn flat and will not glow.");
                }

                return null;
            }

            //falls back to the depth-tested one if the scene has no other, which draws
            //something rather than nothing
            var shader = ignoreDepth && cache.AdditiveShaderNoZTest != null ? cache.AdditiveShaderNoZTest : cache.AdditiveShader;
            var material = new Material(shader);
            material.SetColor("_Color", new Color(tint.r, tint.g, tint.b, 1f));
            //The beams go after the world is drawn, the way the skill effects do it. The
            //depth-free kind goes just before the character sprites instead: the queue is
            //what decides the order between a sprite and something drawn beside it - the
            //sorting order only settles ties within a queue - and an aura in the queue after
            //the characters paints over their feet. The character shadow sits at this same
            //queue for the same reason.
            material.renderQueue = ignoreDepth ? 2999 : 3001;
            materials[tint] = material;

            if (!loggedOnce)
            {
                loggedOnce = true;
                Debug.Log($"[GroundItemAura] Beams are additive, tint carried in the material. "
                          + $"First colour {tint}.");
            }

            return material;
        }

        /// <summary>
        /// A shaft of light: brightest where it meets the ground, gone by the top, and soft
        /// along both edges so it reads as light rather than as a coloured rectangle.
        ///
        /// Drawn rather than imported, like the rest of this. There is no art asset to go
        /// missing from a GRF extract the way a monster sprite can, and one white texture
        /// serves every colour because the renderer tints it.
        /// </summary>
        private static Sprite BeamSprite
        {
            get
            {
                if (beamSprite != null)
                    return beamSprite;

                var texture = new Texture2D(BeamWidth, BeamHeight, TextureFormat.RGBA32, false);
                texture.wrapMode = TextureWrapMode.Clamp;

                for (var y = 0; y < BeamHeight; y++)
                {
                    //full at the foot, nothing at the head, curved so most of the light sits
                    //in the lower part where the item actually is
                    var up = y / (float)(BeamHeight - 1);
                    var vertical = Mathf.Pow(1f - up, 1.7f);

                    for (var x = 0; x < BeamWidth; x++)
                    {
                        var across = Mathf.Abs((x + 0.5f) / BeamWidth - 0.5f) * 2f;
                        var horizontal = Mathf.Pow(Mathf.Clamp01(1f - across), 1.4f);

                        texture.SetPixel(x, y, new Color(1f, 1f, 1f, vertical * horizontal));
                    }
                }

                texture.Apply();
                //pivot at the bottom middle, so it stands up out of the item rather than
                //being centred on it
                beamSprite = Sprite.Create(texture, new Rect(0, 0, BeamWidth, BeamHeight),
                    new Vector2(0.5f, 0f), 100);
                return beamSprite;
            }
        }

        /// <summary>
        /// The ring that lies on the floor.
        ///
        /// This one is the client's own art rather than something drawn here: it is the
        /// texture behind the circle that appears under a ground-targeted spell while it is
        /// being cast, it is greyscale precisely so it can be tinted, and it ships in the
        /// repository rather than coming out of a GRF extract. Borrowing it means the ring
        /// looks like it belongs to this game instead of like a circle somebody drew.
        ///
        /// If it is ever not there, a plain ring is drawn instead. A missing decoration
        /// should cost the decoration, not the feature.
        /// </summary>
        internal static Sprite RingSprite
        {
            get
            {
                if (ringSprite != null)
                    return ringSprite;

                if (!ringResourceMissing)
                {
                    var texture = Resources.Load<Texture2D>(RingTexture);
                    if (texture != null)
                    {
                        ringSprite = Sprite.Create(texture,
                            new Rect(0, 0, texture.width, texture.height),
                            new Vector2(0.5f, 0.5f), 100);
                        return ringSprite;
                    }

                    ringResourceMissing = true;
                    Debug.LogWarning($"[GroundItemAura] No '{RingTexture}' to draw the ring with, "
                                     + "so a plain one is being used instead.");
                }

                ringSprite = DrawnRing();
                return ringSprite;
            }
        }

        /// <summary>A band of light at a fixed radius, faded on both sides of the line.</summary>
        private static Sprite DrawnRing()
        {
            var texture = new Texture2D(RingSize, RingSize, TextureFormat.RGBA32, false);
            texture.wrapMode = TextureWrapMode.Clamp;

            var half = RingSize * 0.5f;
            for (var y = 0; y < RingSize; y++)
            {
                for (var x = 0; x < RingSize; x++)
                {
                    var dx = (x + 0.5f - half) / half;
                    var dy = (y + 0.5f - half) / half;
                    var distance = Mathf.Sqrt(dx * dx + dy * dy);

                    //the line sits just inside the edge so the sprite is not clipped by its
                    //own bounds when it turns
                    var alpha = Mathf.Clamp01(1f - Mathf.Abs(distance - 0.82f) / 0.12f);
                    alpha *= alpha;

                    texture.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, RingSize, RingSize),
                new Vector2(0.5f, 0.5f), 100);
        }

        /// <summary>
        /// A thick turning band, rather than a drawn line.
        /// </summary>
        /// <remarks>
        /// A circle of even brightness gives nothing away when it turns - every frame looks
        /// like the last one, so it reads as a decal sitting there rather than as something
        /// swirling. Sweeping a handful of arms round the band gives the eye bright parts to
        /// follow, and offsetting each arm by the radius bends them into a spiral so the
        /// inside of the band appears to lag behind the outside.
        /// </remarks>
        internal static Sprite SwirlSprite
        {
            get
            {
                if (swirlSprite != null)
                    return swirlSprite;

                var texture = new Texture2D(RingSize, RingSize, TextureFormat.RGBA32, false);
                texture.wrapMode = TextureWrapMode.Clamp;

                var half = RingSize * 0.5f;
                for (var y = 0; y < RingSize; y++)
                {
                    for (var x = 0; x < RingSize; x++)
                    {
                        var dx = (x + 0.5f - half) / half;
                        var dy = (y + 0.5f - half) / half;
                        var distance = Mathf.Sqrt(dx * dx + dy * dy);

                        //a band about a third of the radius across, soft on both sides
                        var band = Mathf.Clamp01(1f - Mathf.Abs(distance - 0.64f) / 0.30f);
                        band *= band;

                        //never all the way down to nothing between the arms, so the band is
                        //still a band rather than a ring of separate blobs
                        var angle = Mathf.Atan2(dy, dx);
                        var arms = 0.55f + 0.45f * Mathf.Sin(angle * SwirlArms + distance * 7f);

                        texture.SetPixel(x, y, new Color(1f, 1f, 1f, band * arms));
                    }
                }

                texture.Apply();
                swirlSprite = Sprite.Create(texture, new Rect(0, 0, RingSize, RingSize),
                    new Vector2(0.5f, 0.5f), 100);
                return swirlSprite;
            }
        }

        /// <summary>A soft round pool for the foot of the beam.</summary>
        internal static Sprite GlowSprite
        {
            get
            {
                if (glowSprite != null)
                    return glowSprite;

                var texture = new Texture2D(GlowSize, GlowSize, TextureFormat.RGBA32, false);
                texture.wrapMode = TextureWrapMode.Clamp;

                var half = GlowSize * 0.5f;
                for (var y = 0; y < GlowSize; y++)
                {
                    for (var x = 0; x < GlowSize; x++)
                    {
                        var dx = (x + 0.5f - half) / half;
                        var dy = (y + 0.5f - half) / half;
                        var distance = Mathf.Sqrt(dx * dx + dy * dy);

                        var alpha = Mathf.Clamp01(1f - distance);
                        alpha *= alpha;

                        texture.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                    }
                }

                texture.Apply();
                glowSprite = Sprite.Create(texture, new Rect(0, 0, GlowSize, GlowSize),
                    new Vector2(0.5f, 0.5f), 100);
                return glowSprite;
            }
        }
    }
}
