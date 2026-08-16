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
        //  red    a card off a boss
        //  blue   gear off an ordinary monster
        //  purple gear off a boss
        //  ore    the colour of the ore
        private static readonly Color CardColor = new Color(1.00f, 0.82f, 0.25f);
        private static readonly Color BossCardColor = new Color(1.00f, 0.25f, 0.22f);
        private static readonly Color GearColor = new Color(0.35f, 0.70f, 1.00f);
        private static readonly Color BossGearColor = new Color(0.72f, 0.40f, 1.00f);

        private static readonly Dictionary<string, Color> OreColors = new Dictionary<string, Color>
        {
            { "Oridecon", new Color(1.00f, 0.45f, 0.15f) },
            { "Rough_Oridecon", new Color(0.95f, 0.50f, 0.25f) },
            { "Elunium", new Color(0.65f, 0.95f, 1.00f) },
            { "Rough_Elunium", new Color(0.70f, 0.90f, 0.98f) },
            { "Phracon", new Color(0.85f, 0.55f, 0.30f) },
            { "Emveretarcon", new Color(0.45f, 0.95f, 0.55f) },
            { "Gold", new Color(1.00f, 0.90f, 0.30f) },
            { "Steel", new Color(0.80f, 0.85f, 0.90f) },
        };

        //the two worth stopping for whatever the odds were on this particular monster
        private static readonly HashSet<string> AlwaysLitOre = new HashSet<string> { "Oridecon", "Elunium" };

        private const int BeamWidth = 32;
        private const int BeamHeight = 256;
        private const int GlowSize = 64;

        private static Sprite beamSprite;
        private static Sprite glowSprite;
        private static Material additiveMaterial;

        private SpriteRenderer beam;
        private SpriteRenderer core;
        private SpriteRenderer hotCore;
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
            aura.strength = 0.85f + tier * 0.05f;
            //so a field of drops does not pulse in lockstep
            aura.phase = Random.value * 10f;

            //Four shafts, one inside the next, each narrower and whiter than the last. With
            //additive blending they sum where they overlap, so the middle of the beam burns
            //out to white while the outside keeps its colour — which is what a bright light
            //actually looks like, and is not something one alpha blended quad can do however
            //opaque it is made.
            aura.beamHeight = 2.9f + tier * 0.6f;
            aura.beam = MakeRenderer(go.transform, "Beam", BeamSprite, Vector3.zero);
            aura.beam.transform.localScale = new Vector3(1.7f + tier * 0.3f, aura.beamHeight, 1f);

            aura.core = MakeRenderer(go.transform, "Core", BeamSprite, Vector3.zero);
            aura.core.transform.localScale = new Vector3(0.9f + tier * 0.12f, aura.beamHeight * 0.92f, 1f);

            aura.hotCore = MakeRenderer(go.transform, "HotCore", BeamSprite, Vector3.zero);
            aura.hotCore.transform.localScale = new Vector3(0.36f + tier * 0.05f, aura.beamHeight * 0.8f, 1f);

            //a pool of light where it is actually lying, so the eye is sent to the item and
            //not to the empty air above it
            aura.glow = MakeRenderer(go.transform, "Glow", GlowSprite, new Vector3(0, 0.05f, 0));
            aura.glow.transform.localScale = Vector3.one * (1.4f + tier * 0.2f);

            aura.Apply(0f);
        }

        private static SpriteRenderer MakeRenderer(Transform parent, string name, Sprite sprite, Vector3 offset)
        {
            var go = new GameObject(name);
            go.layer = parent.gameObject.layer;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = offset;

            var renderer = go.AddComponent<SpriteRenderer>();
            renderer.sprite = sprite;
            //behind the icon, so the item reads on top of its own light
            renderer.sortingOrder = -1;

            var material = AdditiveMaterial;
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

            //The additive shader multiplies the texture by the vertex colour and blends with
            //SrcAlpha One, so what lands on the screen is colour times alpha, added. Alpha
            //is held near the top and brightness comes from stacking, which is the part that
            //has no ceiling: three shafts at full strength are three times the light.
            Paint(beam, tint, 0.86f + pulse * 0.14f);
            Paint(core, Color.Lerp(tint, Color.white, 0.55f), 0.88f + pulse * 0.12f);
            Paint(hotCore, Color.white, 0.82f + pulse * 0.18f);
            Paint(glow, Color.Lerp(tint, Color.white, 0.4f), 0.80f + pulse * 0.20f);

            Stretch(beam, beamHeight, pulse);
            Stretch(core, beamHeight * 0.92f, pulse);
            Stretch(hotCore, beamHeight * 0.8f, pulse);
        }

        private void Paint(SpriteRenderer renderer, Color color, float amount)
        {
            if (renderer == null)
                return;

            color.a = strength * amount;
            renderer.color = color;
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
        /// The blend that lets light behave like light.
        ///
        /// Everything before this was alpha blended, which cannot go brighter than the
        /// colour it is painting with however opaque it is made — the beam was already at
        /// full opacity and still looked timid, because that is the ceiling. Adding instead
        /// of covering has no such ceiling, and it is what every other effect in this client
        /// already uses.
        /// </summary>
        private static Material AdditiveMaterial
        {
            get
            {
                if (additiveMaterial != null)
                    return additiveMaterial;

                var cache = ShaderCache.Instance;
                if (cache == null || cache.AdditiveShader == null)
                    return null;

                additiveMaterial = new Material(cache.AdditiveShader);
                //after the world is drawn, the way the skill effects do it
                additiveMaterial.renderQueue = 3001;
                return additiveMaterial;
            }
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
