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

        private static Sprite beamSprite;
        private static Sprite glowSprite;
        //One material per colour rather than one shared by all of them. The colour has to
        //travel in the material's own Tint property: it is the only one of the shader's two
        //colour inputs that is certain to arrive, and the beams coming out white is what a
        //tint that did not arrive looks like.
        private static readonly Dictionary<Color, Material> additiveMaterials = new Dictionary<Color, Material>();
        private static bool loggedOnce;

        private SpriteRenderer beam;
        private SpriteRenderer core;
        private SpriteRenderer glow;
        private Color tint;
        private float strength;
        private float phase;

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

            var go = new GameObject("Aura");
            go.layer = parent.layer;
            go.transform.SetParent(parent.transform, false);

            var aura = go.AddComponent<GroundItemAura>();
            aura.tint = color;
            aura.strength = 0.72f + tier * 0.06f;
            //so a field of drops does not pulse in lockstep
            aura.phase = Random.value * 10f;

            //Two shafts of the same colour, one inside the other, and no white one. A white
            //shaft fills every channel by itself, and adding it to anything gives white —
            //which is exactly what four stacked layers produced. Two passes of a saturated
            //tint fill the strong channels and leave the weak one weak, so the beam is very
            //bright and still gold, or blue, or purple.
            //Width was the whole problem, not brightness.
            //
            //The scale numbers are multipliers on the sprite's own size, and the sprite is
            //32 wide by 256 tall — so the same number means eight times as much height as
            //width. The old beam came out about half a unit across and seven tall: a needle,
            //and a needle reads as a faint line however bright it is. A character in this
            //game stands about a unit and a half. These numbers put the shaft at roughly two
            //units across and ten tall, which is a pillar you could walk into.
            aura.beamHeight = 3.6f + tier * 0.6f;
            aura.beam = MakeRenderer(go.transform, "Beam", BeamSprite, Vector3.zero, color);
            aura.beam.transform.localScale = new Vector3(6.5f + tier * 1.2f, aura.beamHeight, 1f);

            //The same tint as the shaft around it, not a paler one. Mixing white into the
            //core was a second push toward white on top of the one the stacking already
            //gives, and it is the middle of the beam — the part you actually read the
            //colour off — that it bleached.
            aura.core = MakeRenderer(go.transform, "Core", BeamSprite, Vector3.zero, color);
            aura.core.transform.localScale = new Vector3(2.6f + tier * 0.4f, aura.beamHeight * 0.9f, 1f);

            //a pool of light where it is actually lying, so the eye is sent to the item and
            //not to the empty air above it
            aura.glow = MakeRenderer(go.transform, "Glow", GlowSprite, new Vector3(0, 0.05f, 0), color);
            aura.glow.transform.localScale = Vector3.one * (4.5f + tier * 0.6f);

            aura.Apply(0f);
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
                //How unlikely it was still decides how big and bright the beam is, so the
                //information is kept without anything being left dark.
                color = fromBoss ? BossGearColor : GearColor;
                tier = Mathf.Max(tier, 1);
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
            Paint(glow, 0.45f + pulse * 0.15f);

            Stretch(beam, beamHeight, pulse);
            Stretch(core, beamHeight * 0.9f, pulse);
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
        private static Material MaterialFor(Color tint)
        {
            if (additiveMaterials.TryGetValue(tint, out var found) && found != null)
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

            var material = new Material(cache.AdditiveShader);
            material.SetColor("_Color", new Color(tint.r, tint.g, tint.b, 1f));
            //after the world is drawn, the way the skill effects do it
            material.renderQueue = 3001;
            additiveMaterials[tint] = material;

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

        /// <summary>A soft round pool for the foot of the beam.</summary>
        private static Sprite GlowSprite
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
