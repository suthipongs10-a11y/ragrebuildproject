using System;
using System.Collections.Generic;
using UnityEngine;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// The icon set the reskinned windows draw on. Every icon is described as a signed
    /// distance field and rasterised into a small texture the first time it is asked
    /// for, rather than shipped as an image file: the client's art folders are built
    /// from the player's own GRF extract and are not ours to add files to, and a shape
    /// written as maths antialiases itself and stays clean at any size.
    /// Icons are drawn in white so an Image tints them to whatever the theme needs.
    /// </summary>
    public static class ModernUiIcons
    {
        //large enough to stay smooth at the sizes the windows use, small enough that the
        //whole set costs well under a megabyte even if every icon is eventually touched
        private const int Resolution = 64;

        private static readonly Dictionary<string, Sprite> cache = new Dictionary<string, Sprite>();

        //---------------------------------------------------------------- window icons
        public static Sprite Person => Get("Person", PersonShape);
        public static Sprite Armor => Get("Armor", ArmorShape);
        public static Sprite Bag => Get("Bag", BagShape);
        public static Sprite Book => Get("Book", BookShape);
        public static Sprite Gear => Get("Gear", GearShape);
        public static Sprite Smile => Get("Smile", SmileShape);

        //---------------------------------------------------------------- stat icons
        public static Sprite Sword => Get("Sword", SwordShape);
        public static Sprite Bolt => Get("Bolt", BoltShape);
        public static Sprite Heart => Get("Heart", HeartShape);
        public static Sprite Spark => Get("Spark", SparkShape);
        public static Sprite Target => Get("Target", TargetShape);
        public static Sprite Star => Get("Star", StarShape);
        public static Sprite Shield => Get("Shield", ShieldShape);
        public static Sprite Coin => Get("Coin", CoinShape);

        //---------------------------------------------------------------- equipment slots
        public static Sprite Helmet => Get("Helmet", HelmetShape);
        public static Sprite Glasses => Get("Glasses", GlassesShape);
        public static Sprite Mask => Get("Mask", MaskShape);
        public static Sprite Cape => Get("Cape", CapeShape);
        public static Sprite Boot => Get("Boot", BootShape);
        public static Sprite Ring => Get("Ring", RingShape);

        //---------------------------------------------------------------- controls
        public static Sprite Plus => Get("Plus", PlusShape);
        public static Sprite Minus => Get("Minus", MinusShape);
        public static Sprite Close => Get("Close", CloseShape);
        public static Sprite Check => Get("Check", CheckShape);
        public static Sprite ChevronLeft => Get("ChevronLeft", ChevronLeftShape);
        public static Sprite ChevronRight => Get("ChevronRight", ChevronRightShape);

        //---------------------------------------------------------------- system menu
        public static Sprite Home => Get("Home", HomeShape);
        public static Sprite Refresh => Get("Refresh", RefreshShape);
        public static Sprite Grid => Get("Grid", GridShape);
        public static Sprite Exit => Get("Exit", ExitShape);

        private static Sprite Get(string name, Func<Vector2, float> shape)
        {
            if (cache.TryGetValue(name, out var cached) && cached != null)
                return cached;

            var sprite = Render(name, shape);
            cache[name] = sprite;
            return sprite;
        }

        private static Sprite Render(string name, Func<Vector2, float> shape)
        {
            var texture = new Texture2D(Resolution, Resolution, TextureFormat.RGBA32, false)
            {
                name = "ModernIcon_" + name,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };

            var pixels = new Color32[Resolution * Resolution];
            var unit = 1f / Resolution;
            var edge = unit * 1.4f; //about a pixel and a half of falloff, enough to read as smooth

            for (var y = 0; y < Resolution; y++)
            {
                for (var x = 0; x < Resolution; x++)
                {
                    var point = new Vector2((x + 0.5f) * unit, (y + 0.5f) * unit);
                    var alpha = Mathf.Clamp01(0.5f - shape(point) / edge);
                    pixels[y * Resolution + x] = new Color32(255, 255, 255, (byte)(alpha * 255f));
                }
            }

            texture.SetPixels32(pixels);
            texture.Apply();

            return Sprite.Create(texture, new Rect(0, 0, Resolution, Resolution), new Vector2(0.5f, 0.5f), 100f);
        }

        //---------------------------------------------------------------- shapes
        //every shape works in a zero to one square, and returns how far a point sits
        //outside it: negative inside, zero on the outline, positive outside

        private static float PersonShape(Vector2 p)
        {
            var head = Circle(p, new Vector2(0.5f, 0.71f), 0.16f);
            var body = Box(p, new Vector2(0.5f, 0.30f), new Vector2(0.28f, 0.26f), 0.16f);
            return Mathf.Min(head, body);
        }

        private static float ArmorShape(Vector2 p)
        {
            var torso = Box(p, new Vector2(0.5f, 0.42f), new Vector2(0.23f, 0.29f), 0.07f);
            var shoulders = Convex4(p, new Vector2(0.13f, 0.60f), new Vector2(0.87f, 0.60f),
                new Vector2(0.71f, 0.81f), new Vector2(0.29f, 0.81f));
            var neck = Circle(p, new Vector2(0.5f, 0.84f), 0.115f);
            return Mathf.Max(Mathf.Min(torso, shoulders), -neck);
        }

        private static float BagShape(Vector2 p)
        {
            var body = Box(p, new Vector2(0.5f, 0.38f), new Vector2(0.32f, 0.26f), 0.09f);
            var handle = Mathf.Max(Ring(p, new Vector2(0.5f, 0.64f), 0.17f, 0.05f), 0.64f - p.y);
            return Mathf.Min(body, handle);
        }

        private static float BookShape(Vector2 p)
        {
            var left = Box(p, new Vector2(0.30f, 0.48f), new Vector2(0.17f, 0.28f), 0.05f);
            var right = Box(p, new Vector2(0.70f, 0.48f), new Vector2(0.17f, 0.28f), 0.05f);
            var spine = Box(p, new Vector2(0.5f, 0.48f), new Vector2(0.035f, 0.32f), 0.02f);
            return Mathf.Min(Mathf.Min(left, right), spine);
        }

        private static float GearShape(Vector2 p)
        {
            var center = new Vector2(0.5f, 0.5f);
            var d = Circle(p, center, 0.27f);
            for (var i = 0; i < 8; i++)
            {
                var rotated = Rotate(p, center, i * 45f);
                d = Mathf.Min(d, Box(rotated, new Vector2(0.5f, 0.79f), new Vector2(0.075f, 0.10f), 0.03f));
            }

            return Mathf.Max(d, -Circle(p, center, 0.115f));
        }

        private static float SmileShape(Vector2 p)
        {
            var face = Ring(p, new Vector2(0.5f, 0.5f), 0.36f, 0.055f);
            var eyes = Mathf.Min(Circle(p, new Vector2(0.38f, 0.60f), 0.048f),
                Circle(p, new Vector2(0.62f, 0.60f), 0.048f));
            var mouth = Mathf.Max(Ring(p, new Vector2(0.5f, 0.52f), 0.17f, 0.045f), p.y - 0.50f);
            return Mathf.Min(Mathf.Min(face, mouth), eyes);
        }

        private static float SwordShape(Vector2 p)
        {
            var blade = Box(p, new Vector2(0.5f, 0.60f), new Vector2(0.075f, 0.24f), 0.02f);
            var tip = Convex3(p, new Vector2(0.425f, 0.82f), new Vector2(0.575f, 0.82f), new Vector2(0.5f, 0.95f));
            var guard = Box(p, new Vector2(0.5f, 0.32f), new Vector2(0.23f, 0.045f), 0.03f);
            var grip = Box(p, new Vector2(0.5f, 0.20f), new Vector2(0.05f, 0.10f), 0.03f);
            var pommel = Circle(p, new Vector2(0.5f, 0.09f), 0.06f);
            return Mathf.Min(Mathf.Min(Mathf.Min(blade, tip), Mathf.Min(guard, grip)), pommel);
        }

        private static float BoltShape(Vector2 p)
        {
            var upper = Convex3(p, new Vector2(0.62f, 0.94f), new Vector2(0.26f, 0.44f), new Vector2(0.54f, 0.44f));
            var lower = Convex3(p, new Vector2(0.74f, 0.56f), new Vector2(0.46f, 0.56f), new Vector2(0.38f, 0.06f));
            return Mathf.Min(upper, lower);
        }

        private static float HeartShape(Vector2 p)
        {
            var lobes = Mathf.Min(Circle(p, new Vector2(0.34f, 0.64f), 0.21f),
                Circle(p, new Vector2(0.66f, 0.64f), 0.21f));
            var point = Convex3(p, new Vector2(0.14f, 0.66f), new Vector2(0.5f, 0.14f), new Vector2(0.86f, 0.66f));
            return Mathf.Min(lobes, point);
        }

        private static float SparkShape(Vector2 p)
        {
            var big = Mathf.Min(
                Convex4(p, new Vector2(0.46f, 0.06f), new Vector2(0.60f, 0.46f), new Vector2(0.46f, 0.86f),
                    new Vector2(0.32f, 0.46f)),
                Convex4(p, new Vector2(0.06f, 0.46f), new Vector2(0.46f, 0.32f), new Vector2(0.86f, 0.46f),
                    new Vector2(0.46f, 0.60f)));
            var small = Mathf.Min(
                Convex4(p, new Vector2(0.80f, 0.66f), new Vector2(0.87f, 0.80f), new Vector2(0.80f, 0.94f),
                    new Vector2(0.73f, 0.80f)),
                Convex4(p, new Vector2(0.66f, 0.80f), new Vector2(0.80f, 0.73f), new Vector2(0.94f, 0.80f),
                    new Vector2(0.80f, 0.87f)));
            return Mathf.Min(big, small);
        }

        private static float TargetShape(Vector2 p)
        {
            var center = new Vector2(0.5f, 0.5f);
            var outer = Ring(p, center, 0.28f, 0.055f);
            var dot = Circle(p, center, 0.075f);
            var vertical = Mathf.Min(Segment(p, new Vector2(0.5f, 0.72f), new Vector2(0.5f, 0.95f), 0.035f),
                Segment(p, new Vector2(0.5f, 0.05f), new Vector2(0.5f, 0.28f), 0.035f));
            var horizontal = Mathf.Min(Segment(p, new Vector2(0.72f, 0.5f), new Vector2(0.95f, 0.5f), 0.035f),
                Segment(p, new Vector2(0.05f, 0.5f), new Vector2(0.28f, 0.5f), 0.035f));
            return Mathf.Min(Mathf.Min(outer, dot), Mathf.Min(vertical, horizontal));
        }

        private static float StarShape(Vector2 p)
        {
            var center = new Vector2(0.5f, 0.5f);
            var d = Circle(p, center, 0.155f);
            for (var i = 0; i < 5; i++)
            {
                var angle = Mathf.PI / 2f + i * Mathf.PI * 2f / 5f;
                var tip = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * 0.42f;
                var right = center + new Vector2(Mathf.Cos(angle - 0.85f), Mathf.Sin(angle - 0.85f)) * 0.18f;
                var left = center + new Vector2(Mathf.Cos(angle + 0.85f), Mathf.Sin(angle + 0.85f)) * 0.18f;
                d = Mathf.Min(d, Convex3(p, right, tip, left));
            }

            return d;
        }

        private static float ShieldShape(Vector2 p)
        {
            var top = Box(p, new Vector2(0.5f, 0.64f), new Vector2(0.31f, 0.24f), 0.09f);
            var point = Convex3(p, new Vector2(0.19f, 0.66f), new Vector2(0.5f, 0.14f), new Vector2(0.81f, 0.66f));
            return Mathf.Min(top, point);
        }

        private static float CoinShape(Vector2 p)
        {
            var center = new Vector2(0.5f, 0.5f);
            return Mathf.Min(Ring(p, center, 0.30f, 0.055f), Ring(p, center, 0.155f, 0.045f));
        }

        private static float HelmetShape(Vector2 p)
        {
            var dome = Mathf.Max(Circle(p, new Vector2(0.5f, 0.46f), 0.32f), 0.44f - p.y);
            var brim = Box(p, new Vector2(0.5f, 0.40f), new Vector2(0.37f, 0.06f), 0.03f);
            return Mathf.Min(dome, brim);
        }

        private static float GlassesShape(Vector2 p)
        {
            var lenses = Mathf.Min(Ring(p, new Vector2(0.28f, 0.5f), 0.17f, 0.05f),
                Ring(p, new Vector2(0.72f, 0.5f), 0.17f, 0.05f));
            var bridge = Segment(p, new Vector2(0.44f, 0.53f), new Vector2(0.56f, 0.53f), 0.032f);
            return Mathf.Min(lenses, bridge);
        }

        private static float MaskShape(Vector2 p)
        {
            var body = Box(p, new Vector2(0.5f, 0.42f), new Vector2(0.27f, 0.17f), 0.08f);
            var straps = Mathf.Min(Segment(p, new Vector2(0.24f, 0.55f), new Vector2(0.09f, 0.70f), 0.035f),
                Segment(p, new Vector2(0.76f, 0.55f), new Vector2(0.91f, 0.70f), 0.035f));
            return Mathf.Min(body, straps);
        }

        private static float CapeShape(Vector2 p)
        {
            return Convex4(p, new Vector2(0.30f, 0.86f), new Vector2(0.14f, 0.14f),
                new Vector2(0.86f, 0.14f), new Vector2(0.70f, 0.86f));
        }

        private static float BootShape(Vector2 p)
        {
            var shaft = Box(p, new Vector2(0.37f, 0.58f), new Vector2(0.15f, 0.30f), 0.05f);
            var foot = Box(p, new Vector2(0.53f, 0.26f), new Vector2(0.31f, 0.14f), 0.06f);
            return Mathf.Min(shaft, foot);
        }

        private static float RingShape(Vector2 p)
        {
            var band = Ring(p, new Vector2(0.5f, 0.40f), 0.24f, 0.06f);
            var gem = Convex4(p, new Vector2(0.5f, 0.62f), new Vector2(0.64f, 0.78f), new Vector2(0.5f, 0.94f),
                new Vector2(0.36f, 0.78f));
            return Mathf.Min(band, gem);
        }

        private static float PlusShape(Vector2 p)
        {
            return Mathf.Min(Box(p, new Vector2(0.5f, 0.5f), new Vector2(0.34f, 0.075f), 0.035f),
                Box(p, new Vector2(0.5f, 0.5f), new Vector2(0.075f, 0.34f), 0.035f));
        }

        private static float MinusShape(Vector2 p)
        {
            return Box(p, new Vector2(0.5f, 0.5f), new Vector2(0.34f, 0.075f), 0.035f);
        }

        private static float CloseShape(Vector2 p)
        {
            return Mathf.Min(Segment(p, new Vector2(0.24f, 0.24f), new Vector2(0.76f, 0.76f), 0.062f),
                Segment(p, new Vector2(0.76f, 0.24f), new Vector2(0.24f, 0.76f), 0.062f));
        }

        private static float CheckShape(Vector2 p)
        {
            return Mathf.Min(Segment(p, new Vector2(0.16f, 0.52f), new Vector2(0.40f, 0.24f), 0.07f),
                Segment(p, new Vector2(0.40f, 0.24f), new Vector2(0.84f, 0.74f), 0.07f));
        }

        private static float ChevronLeftShape(Vector2 p)
        {
            return Mathf.Min(Segment(p, new Vector2(0.64f, 0.86f), new Vector2(0.34f, 0.5f), 0.07f),
                Segment(p, new Vector2(0.34f, 0.5f), new Vector2(0.64f, 0.14f), 0.07f));
        }

        private static float ChevronRightShape(Vector2 p)
        {
            return ChevronLeftShape(new Vector2(1f - p.x, p.y));
        }

        private static float HomeShape(Vector2 p)
        {
            var roof = Convex3(p, new Vector2(0.94f, 0.55f), new Vector2(0.5f, 0.92f), new Vector2(0.06f, 0.55f));
            var body = Box(p, new Vector2(0.5f, 0.32f), new Vector2(0.30f, 0.24f), 0.05f);
            return Mathf.Min(roof, body);
        }

        private static float RefreshShape(Vector2 p)
        {
            var center = new Vector2(0.5f, 0.5f);
            //an open circle: the arc is cut away where the arrow head takes over
            var arc = Mathf.Max(Ring(p, center, 0.28f, 0.065f),
                -Box(p, new Vector2(0.80f, 0.74f), new Vector2(0.28f, 0.24f), 0f));
            var head = Convex3(p, new Vector2(0.74f, 0.56f), new Vector2(0.94f, 0.78f), new Vector2(0.62f, 0.88f));
            return Mathf.Min(arc, head);
        }

        private static float GridShape(Vector2 p)
        {
            var d = float.MaxValue;
            for (var x = 0; x < 2; x++)
            {
                for (var y = 0; y < 2; y++)
                {
                    d = Mathf.Min(d, Box(p, new Vector2(0.32f + x * 0.36f, 0.32f + y * 0.36f),
                        new Vector2(0.14f, 0.14f), 0.04f));
                }
            }

            return d;
        }

        private static float ExitShape(Vector2 p)
        {
            //a doorway with the right hand wall opened up, and an arrow leaving through it
            var frame = Mathf.Max(Box(p, new Vector2(0.40f, 0.5f), new Vector2(0.30f, 0.36f), 0.07f),
                -Box(p, new Vector2(0.40f, 0.5f), new Vector2(0.21f, 0.27f), 0.04f));
            frame = Mathf.Max(frame, -Box(p, new Vector2(0.80f, 0.5f), new Vector2(0.26f, 0.16f), 0f));
            var arrow = Mathf.Min(Segment(p, new Vector2(0.46f, 0.5f), new Vector2(0.82f, 0.5f), 0.055f),
                Convex3(p, new Vector2(0.72f, 0.30f), new Vector2(0.94f, 0.5f), new Vector2(0.72f, 0.70f)));
            return Mathf.Min(frame, arrow);
        }

        //---------------------------------------------------------------- primitives

        private static float Circle(Vector2 p, Vector2 center, float radius)
        {
            return (p - center).magnitude - radius;
        }

        private static float Ring(Vector2 p, Vector2 center, float radius, float thickness)
        {
            return Mathf.Abs(Circle(p, center, radius)) - thickness;
        }

        private static float Box(Vector2 p, Vector2 center, Vector2 half, float round)
        {
            var qx = Mathf.Abs(p.x - center.x) - (half.x - round);
            var qy = Mathf.Abs(p.y - center.y) - (half.y - round);
            var outside = new Vector2(Mathf.Max(qx, 0f), Mathf.Max(qy, 0f)).magnitude;
            return outside + Mathf.Min(Mathf.Max(qx, qy), 0f) - round;
        }

        private static float Segment(Vector2 p, Vector2 a, Vector2 b, float thickness)
        {
            var pa = p - a;
            var ba = b - a;
            var length = Vector2.Dot(ba, ba);
            var h = length > 0f ? Mathf.Clamp01(Vector2.Dot(pa, ba) / length) : 0f;
            return (pa - ba * h).magnitude - thickness;
        }

        //corners are listed counter clockwise; the result is the distance to the nearest
        //edge, which is exact along the outline and so gives clean antialiasing
        private static float Convex3(Vector2 p, Vector2 a, Vector2 b, Vector2 c)
        {
            return Mathf.Max(Edge(p, a, b), Mathf.Max(Edge(p, b, c), Edge(p, c, a)));
        }

        private static float Convex4(Vector2 p, Vector2 a, Vector2 b, Vector2 c, Vector2 d)
        {
            return Mathf.Max(Mathf.Max(Edge(p, a, b), Edge(p, b, c)),
                Mathf.Max(Edge(p, c, d), Edge(p, d, a)));
        }

        private static float Edge(Vector2 p, Vector2 a, Vector2 b)
        {
            var direction = (b - a).normalized;
            var normal = new Vector2(direction.y, -direction.x);
            return Vector2.Dot(p - a, normal);
        }

        private static Vector2 Rotate(Vector2 p, Vector2 center, float degrees)
        {
            var radians = degrees * Mathf.Deg2Rad;
            var sin = Mathf.Sin(radians);
            var cos = Mathf.Cos(radians);
            var v = p - center;
            return center + new Vector2(v.x * cos - v.y * sin, v.x * sin + v.y * cos);
        }
    }
}
