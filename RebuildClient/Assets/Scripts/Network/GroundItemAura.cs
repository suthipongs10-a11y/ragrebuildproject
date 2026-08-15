using System.Collections.Generic;
using RebuildSharedData.ClientTypes;
using RebuildSharedData.Enum;
using UnityEngine;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// The light around something worth picking up.
    ///
    /// A rare drop and a jellopy land on the floor looking exactly alike, and on a map with
    /// twenty things on the ground the good one goes unnoticed. This is the halo that makes
    /// it obvious from across the screen, and the moment it appears is most of the reason
    /// hunting is fun at all.
    ///
    /// What glows is decided here rather than on the server because the client already
    /// holds the item's class and code. The one thing it cannot know is how unlikely the
    /// drop was, and that is exactly what the server sends: a rarity of nothing special to
    /// almost never, on a scale of zero to three.
    /// </summary>
    public class GroundItemAura : MonoBehaviour
    {
        //Cards are gold, worn gear is blue, and ore takes the colour of the ore. Kept as a
        //table rather than a chain of ifs because the whole rule is meant to be read at
        //once and argued with.
        private static readonly Color CardColor = new Color(1.00f, 0.82f, 0.25f);
        private static readonly Color GearColor = new Color(0.35f, 0.70f, 1.00f);

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

        //the two that are worth stopping for whatever the odds were on this particular
        //monster, so they are lit even when the server called the drop ordinary
        private static readonly HashSet<string> AlwaysLitOre = new HashSet<string> { "Oridecon", "Elunium" };

        private const int TextureSize = 64;
        private static Sprite glowSprite;

        private SpriteRenderer sprite;
        private Color tint;
        private float baseScale;
        private float baseAlpha;
        private float phase;

        /// <summary>
        /// Puts a light on a dropped item, or does not, according to what it is and how
        /// unlikely it was. Returns quietly for everything ordinary, which is nearly
        /// everything: a halo on every drop is the same as a halo on none.
        /// </summary>
        public static void TryAttach(GameObject parent, ItemData data, int rarity)
        {
            if (parent == null || data == null)
                return;

            if (!Classify(data, rarity, out var color, out var tier))
                return;

            var go = new GameObject("Aura");
            go.layer = parent.layer;
            go.transform.SetParent(parent.transform, false);
            //lifted to sit around the icon rather than around its feet
            go.transform.localPosition = new Vector3(0, 0.16f, 0);

            var renderer = go.AddComponent<SpriteRenderer>();
            renderer.sprite = GlowSprite;
            //behind the icon, in front of the shadow the item already carries
            renderer.sortingOrder = -1;

            var aura = go.AddComponent<GroundItemAura>();
            aura.sprite = renderer;
            aura.tint = color;
            aura.baseScale = 0.42f + tier * 0.16f;
            aura.baseAlpha = 0.30f + tier * 0.14f;
            //so a field of drops does not pulse in lockstep
            aura.phase = Random.value * 10f;
            aura.Apply(0f);
        }

        /// <summary>
        /// The whole rule, in one place.
        /// </summary>
        private static bool Classify(ItemData data, int rarity, out Color color, out int tier)
        {
            color = default;
            tier = rarity;

            if (data.ItemClass == ItemClass.Card)
            {
                //a card is never an ordinary drop, whatever band the roll fell in — some
                //arrive by other routes entirely, where there was no roll to band
                color = CardColor;
                tier = Mathf.Max(rarity, 2);
                return true;
            }

            if (!string.IsNullOrEmpty(data.Code) && OreColors.TryGetValue(data.Code, out var oreColor))
            {
                if (AlwaysLitOre.Contains(data.Code))
                {
                    color = oreColor;
                    tier = Mathf.Max(rarity, 1);
                    return true;
                }

                if (rarity < 1)
                    return false;

                color = oreColor;
                return true;
            }

            if (data.ItemClass == ItemClass.Weapon || data.ItemClass == ItemClass.Equipment)
            {
                //gear follows the odds, because a monster whose armour drops one time in
                //three is not handing you a prize
                if (rarity < 1)
                    return false;

                color = GearColor;
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
            if (sprite == null)
                return;

            //a slow breath rather than a blink: the eye is caught by something that moves
            //and annoyed by something that flashes
            var pulse = 0.5f + 0.5f * Mathf.Sin(t * 2.2f);

            var scale = baseScale * (0.92f + pulse * 0.16f);
            transform.localScale = new Vector3(scale, scale, scale);

            var color = tint;
            color.a = baseAlpha * (0.72f + pulse * 0.28f);
            sprite.color = color;
        }

        /// <summary>
        /// A soft round glow, drawn rather than imported. One texture serves every colour,
        /// since the renderer tints it, and drawing it here means there is no art asset to
        /// go missing from a GRF extract the way a monster sprite can.
        /// </summary>
        private static Sprite GlowSprite
        {
            get
            {
                if (glowSprite != null)
                    return glowSprite;

                var texture = new Texture2D(TextureSize, TextureSize, TextureFormat.RGBA32, false);
                texture.wrapMode = TextureWrapMode.Clamp;

                var half = TextureSize * 0.5f;
                for (var y = 0; y < TextureSize; y++)
                {
                    for (var x = 0; x < TextureSize; x++)
                    {
                        var dx = (x + 0.5f - half) / half;
                        var dy = (y + 0.5f - half) / half;
                        var distance = Mathf.Sqrt(dx * dx + dy * dy);

                        //squared falloff, so the centre reads as a source of light and the
                        //edge fades out instead of ending on a visible circle
                        var alpha = Mathf.Clamp01(1f - distance);
                        alpha *= alpha;

                        texture.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                    }
                }

                texture.Apply();
                glowSprite = Sprite.Create(texture, new Rect(0, 0, TextureSize, TextureSize),
                    new Vector2(0.5f, 0.5f), 100);
                return glowSprite;
            }
        }
    }
}
