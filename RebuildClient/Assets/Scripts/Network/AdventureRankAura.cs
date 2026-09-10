using UnityEngine;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// A ring of light at the feet of the local player, standing in for the level aura's
    /// idea of "you have reached something" but read off Adventure Book rank instead of
    /// level: a inner and outer ring like the level aura, but bigger, and a cluster of
    /// vertical light beams standing round it - the level aura has nothing that stands
    /// upright, only things that lie along the floor or drift straight up as sparks, so
    /// the beams are the one new shape here. Rank five and over swaps the whole thing for
    /// a bigger, warmer version rather than fading between the two: a rank that just
    /// turned over is a moment, not a gradient.
    /// </summary>
    /// <remarks>
    /// Self only, and not by choice of scope but by what the wire carries: rank arrives on
    /// <see cref="AdventureBookState"/>, which is filled in only for whichever character is
    /// this client's own - the server answers "what is my rank" and never "what is theirs".
    /// The level aura can light up on anybody standing next to you because level rides in
    /// the spawn packet, which every nearby client already has for everybody; rank would
    /// need the same kind of seat to do the same trick, and does not have one yet. Until it
    /// does, this is a mirror for the one person already guaranteed to have the number: the
    /// player looking at their own feet.
    ///
    /// The rank used is read straight off <see cref="AdventureBookState.Rank"/> every frame
    /// rather than cached, so it follows a star landing live the way the level aura follows
    /// a ding live, with the same nothing-to-keep-in-step.
    /// </remarks>
    public class AdventureRankAura : MonoBehaviour
    {
        /// <summary>Below this rank there is nothing to show yet.</summary>
        private const int MinRank = 1;

        /// <summary>Rank five and up gets the bigger, warmer version.</summary>
        private const int BigRankThreshold = 5;

        /// <summary>
        /// Mirrors AdventureBookRank.MaxRank on the server. Not shared code - the server
        /// project isn't visible from the client - so if the book's ladder ever grows past
        /// ten this stops being the true ceiling for the debug preview below, though the
        /// live rank read off the wire is never bound by it.
        /// </summary>
        private const int MaxRankForPreview = 10;

        private const float RingEdge = 0.85f;

        // Tier one: rank one through four. Sized a step past the level aura's own rings so
        // "for adventure rank" reads as its own thing rather than a recolour of the level one.
        private const float Tier1InnerRadius = 0.62f;
        private const float Tier1InnerBand = 0.07f;
        private const float Tier1OuterRadius = 1.05f;
        private const float Tier1OuterBand = 0.10f;
        private const float Tier1HaloWidth = 5.0f;
        private const float Tier1BeamRadius = 1.00f;
        private const float Tier1BeamHeight = 1.6f;
        private const float Tier1BeamWidth = 0.22f;
        private const int Tier1BeamCount = 4;

        // Tier two: rank five and up. Bigger again, and more of the beams lit.
        private const float Tier2InnerRadius = 0.72f;
        private const float Tier2InnerBand = 0.08f;
        private const float Tier2OuterRadius = 1.28f;
        private const float Tier2OuterBand = 0.12f;
        private const float Tier2HaloWidth = 6.4f;
        private const float Tier2BeamRadius = 1.22f;
        private const float Tier2BeamHeight = 2.3f;
        private const float Tier2BeamWidth = 0.27f;
        private const int Tier2BeamCount = 8;

        /// <summary>Every beam slot the object owns; a tier lights only its own share of them.</summary>
        private const int MaxBeamCount = Tier2BeamCount;

        private const int MoteCount = 8;
        private const float MoteRise = 0.22f;
        private const float MoteHeight = 2.2f;
        private const float MoteRadius = 0.9f;
        private const float MoteSway = 0.18f;

        private const float BeamSpin = 5f;

        private const int Size = 160;

        // Cool green-teal: a book still being filled in.
        private static readonly Color Tier1Body = new Color(0.72f, 0.95f, 0.80f);
        private static readonly Color Tier1Fringe = new Color(0.30f, 0.80f, 0.52f);

        // Warm gold: the book paying off.
        private static readonly Color Tier2Body = new Color(1.00f, 0.90f, 0.62f);
        private static readonly Color Tier2Fringe = new Color(0.95f, 0.68f, 0.22f);

        private static Sprite ringSprite_Tier1Inner;
        private static Sprite ringSprite_Tier1Outer;
        private static Sprite ringSprite_Tier2Inner;
        private static Sprite ringSprite_Tier2Outer;
        private static Sprite haloSprite;
        private static Sprite beamSprite;
        private static Sprite sparkSprite;

        private ServerControllable owner;
        private Transform parts;
        private SpriteRenderer halo;
        private SpriteRenderer innerRing;
        private SpriteRenderer outerRing;
        private SpriteRenderer[] beams;
        private SpriteRenderer[] motes;
        private float beamAngle;
        private float phase;
        private bool builtForBigTier;

        private Transform view;

        /// <summary>Editor-only preview so a rank ten testing pass doesn't need ten weeks of stars.</summary>
        private static int debugPreviewRank = -1;

        /// <summary>
        /// Puts the watcher on a character - but only ever keeps it if that character is the
        /// local player, since rank is the one stat this client only ever has for itself.
        /// </summary>
        public static void Attach(ServerControllable control)
        {
            if (control == null || control.gameObject == null || !control.IsMainCharacter)
                return;

            if (control.GetComponent<AdventureRankAura>() != null)
                return;

            var aura = control.gameObject.AddComponent<AdventureRankAura>();
            aura.owner = control;
            aura.phase = Random.value * 10f;
            aura.beamAngle = Random.value * 360f;
        }

        private void Update()
        {
            if (owner == null)
            {
                if (parts != null)
                    parts.gameObject.SetActive(false);
                return;
            }

            var rank = AdventureBookState.Received ? AdventureBookState.Rank : 0;

            if (Application.isEditor)
                rank = ReadDebugPreview(rank);

            var wanted = rank >= MinRank && !owner.IsHidden && !owner.IsHiddenForPerformance;

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

            var big = rank >= BigRankThreshold;

            if (parts == null)
                Build();
            else if (!parts.gameObject.activeSelf)
                parts.gameObject.SetActive(true);

            if (big != builtForBigTier)
                Retint(big);

            Apply(Time.time + phase, big);
        }

        /// <summary>
        /// F7 steps a local preview rank down, F8 steps it up; below zero it is off and the
        /// real rank shows. Editor-only - see Application.isEditor at the call site - so it
        /// never ships with a build a player could stumble onto.
        /// </summary>
        private int ReadDebugPreview(int realRank)
        {
            if (Input.GetKeyDown(KeyCode.F7))
            {
                debugPreviewRank = debugPreviewRank <= 0 ? -1 : debugPreviewRank - 1;
                AnnouncePreview();
            }
            else if (Input.GetKeyDown(KeyCode.F8))
            {
                debugPreviewRank = Mathf.Clamp(debugPreviewRank + 1, 0, MaxRankForPreview);
                AnnouncePreview();
            }

            return debugPreviewRank >= 0 ? debugPreviewRank : realRank;
        }

        private void AnnouncePreview()
        {
            if (CameraFollower.Instance == null)
                return;

            var text = debugPreviewRank < 0
                ? "[Debug] ออร่า Adventure: ปิดพรีวิว ใช้อันดับจริง"
                : $"[Debug] ออร่า Adventure: พรีวิวอันดับ {debugPreviewRank} (F7 ลด, F8 เพิ่ม, ต่ำกว่า 0 = ปิด)";
            CameraFollower.Instance.AppendChatText(text);
        }

        private void Build()
        {
            var go = new GameObject("AdventureRankAura");
            go.layer = gameObject.layer;
            go.transform.SetParent(transform, false);
            parts = go.transform;

            halo = MakePart("Halo", HaloSprite, Tier1Fringe);
            outerRing = MakePart("OuterRing", OuterRingSprite(false), Tier1Body);
            innerRing = MakePart("InnerRing", InnerRingSprite(false), Tier1Body);

            beams = new SpriteRenderer[MaxBeamCount];
            for (var i = 0; i < MaxBeamCount; i++)
                beams[i] = MakePart("Beam" + i, BeamSprite, i % 2 == 0 ? Tier1Body : Tier1Fringe);

            motes = new SpriteRenderer[MoteCount];
            for (var i = 0; i < MoteCount; i++)
                motes[i] = MakePart("Spark" + i, SparkSprite, Tier1Body);

            builtForBigTier = false;
        }

        /// <summary>Swaps every part's sprite and tint for the tier that just became current.</summary>
        private void Retint(bool big)
        {
            var body = big ? Tier2Body : Tier1Body;
            var fringe = big ? Tier2Fringe : Tier1Fringe;

            Retint(halo, HaloSprite, fringe);
            Retint(outerRing, OuterRingSprite(big), body);
            Retint(innerRing, InnerRingSprite(big), body);

            for (var i = 0; i < beams.Length; i++)
                Retint(beams[i], BeamSprite, i % 2 == 0 ? body : fringe);

            for (var i = 0; i < motes.Length; i++)
                Retint(motes[i], SparkSprite, body);

            builtForBigTier = big;
        }

        private static void Retint(SpriteRenderer renderer, Sprite sprite, Color tint)
        {
            if (renderer == null)
                return;

            renderer.sprite = sprite;
            var material = GroundItemAura.MaterialFor(tint, true);
            if (material != null)
                renderer.sharedMaterial = material;
        }

        private SpriteRenderer MakePart(string name, Sprite sprite, Color tint)
        {
            var go = new GameObject(name);
            go.layer = parts.gameObject.layer;
            go.transform.SetParent(parts, false);

            var renderer = go.AddComponent<SpriteRenderer>();
            renderer.sprite = sprite;
            renderer.sortingOrder = -20;

            var material = GroundItemAura.MaterialFor(tint, true);
            if (material != null)
                renderer.sharedMaterial = material;

            return renderer;
        }

        private void Apply(float t, bool big)
        {
            var origin = transform.position;
            var facing = view.rotation;
            var up = facing * Vector3.up;

            var pulse = 0.5f + 0.5f * Mathf.Sin(t * 1.8f);

            var pitch = Mathf.Abs(view.forward.y);
            var squash = Mathf.Clamp(pitch * 0.75f, 0.30f, 0.60f);

            var innerRadius = big ? Tier2InnerRadius : Tier1InnerRadius;
            var outerRadius = big ? Tier2OuterRadius : Tier1OuterRadius;
            var haloWidth = big ? Tier2HaloWidth : Tier1HaloWidth;
            var beamRadius = big ? Tier2BeamRadius : Tier1BeamRadius;
            var beamHeight = big ? Tier2BeamHeight : Tier1BeamHeight;
            var beamWidth = big ? Tier2BeamWidth : Tier1BeamWidth;
            var beamCount = big ? Tier2BeamCount : Tier1BeamCount;

            Place(halo, origin + up * 0.3f, facing, haloWidth, haloWidth * 0.8f);
            Paint(halo, 0.09f + pulse * 0.05f);

            var innerWidth = 2f * innerRadius / RingEdge * (1f + 0.03f * pulse);
            Place(innerRing, origin, facing, innerWidth, innerWidth * squash);
            Paint(innerRing, 0.45f + pulse * 0.15f);

            var outerWidth = 2f * outerRadius / RingEdge * (1.03f - 0.03f * pulse);
            Place(outerRing, origin, facing, outerWidth, outerWidth * squash);
            Paint(outerRing, 0.40f + pulse * 0.15f);

            StandBeams(t, origin, facing, up, squash, beamCount, beamRadius, beamWidth, beamHeight);
            DriftMotes(t, origin, facing, big);
        }

        /// <summary>
        /// Plants a ring of vertical light around the outer ring's edge, standing straight up
        /// on screen rather than radiating outward the way a burst would - the shape a level
        /// aura has nothing of, which is the point of building a second aura instead of just
        /// recolouring the first.
        /// </summary>
        private void StandBeams(float t, Vector3 origin, Quaternion facing, Vector3 up, float squash,
            int count, float radius, float width, float height)
        {
            if (beams == null)
                return;

            beamAngle = Mathf.Repeat(beamAngle + Time.deltaTime * BeamSpin, 360f);

            for (var i = 0; i < beams.Length; i++)
            {
                var beam = beams[i];
                if (beam == null)
                    continue;

                if (i >= count)
                {
                    Paint(beam, 0f);
                    continue;
                }

                var angle = beamAngle + i * (360f / count);
                var radians = angle * Mathf.Deg2Rad;
                var direction = facing * new Vector3(-Mathf.Sin(radians), Mathf.Cos(radians), 0f);
                var foot = radius * Ellipse(angle, squash);

                var flicker = 0.5f + 0.5f * Mathf.Sin(t * (1.4f + 0.17f * i) + i * 2.2f);

                beam.transform.position = origin + up * 0.05f + direction * foot;
                beam.transform.rotation = facing;
                SetSize(beam, width * (0.85f + 0.2f * flicker), height * (0.8f + 0.25f * flicker));
                Paint(beam, 0.20f + 0.30f * flicker);
            }
        }

        private static float Ellipse(float angle, float squash)
        {
            var radians = angle * Mathf.Deg2Rad;
            var upness = Mathf.Cos(radians);
            var sideness = Mathf.Sin(radians);
            return 1f / Mathf.Sqrt(sideness * sideness + upness * upness / (squash * squash));
        }

        private void DriftMotes(float t, Vector3 origin, Quaternion facing, bool big)
        {
            if (motes == null)
                return;

            var height = big ? MoteHeight * 1.2f : MoteHeight;

            for (var i = 0; i < motes.Length; i++)
            {
                var mote = motes[i];
                if (mote == null)
                    continue;

                var life = Mathf.Repeat(t * MoteRise + i / (float)motes.Length, 1f);

                var angle = i * 2.6f + life * 1.6f;
                var radius = MoteRadius * (1f - life * 0.4f);
                var sway = Mathf.Sin(t * 2.3f + i * 1.9f) * MoteSway * life;

                mote.transform.position = origin + new Vector3(
                    Mathf.Cos(angle) * radius + sway,
                    0.1f + life * height,
                    Mathf.Sin(angle) * radius);
                mote.transform.rotation = facing;

                var fade = Mathf.Sin(life * Mathf.PI);
                var twinkle = 0.6f + 0.4f * Mathf.Sin(t * (3.6f + (i % 4) * 1.1f) + i * 1.8f);
                var width = (0.09f + (i % 3) * 0.03f) * (0.6f + 0.4f * fade);
                SetSize(mote, width, width);
                Paint(mote, fade * twinkle * 0.65f);
            }
        }

        private static void Paint(SpriteRenderer renderer, float amount)
        {
            if (renderer != null)
                renderer.color = new Color(1f, 1f, 1f, amount);
        }

        private void Place(SpriteRenderer renderer, Vector3 position, Quaternion facing, float width, float height)
        {
            if (renderer == null)
                return;

            renderer.transform.position = position;
            renderer.transform.rotation = facing;
            SetSize(renderer, width, height);
        }

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

        private static Sprite InnerRingSprite(bool big)
        {
            if (big)
                return ringSprite_Tier2Inner ??= Ring(Tier2InnerBand);
            return ringSprite_Tier1Inner ??= Ring(Tier1InnerBand);
        }

        private static Sprite OuterRingSprite(bool big)
        {
            if (big)
                return ringSprite_Tier2Outer ??= Ring(Tier2OuterBand);
            return ringSprite_Tier1Outer ??= Ring(Tier1OuterBand);
        }

        private static Sprite Ring(float band)
        {
            return Bake((dx, dy) =>
            {
                var distance = Mathf.Sqrt(dx * dx + dy * dy);
                var line = Mathf.Clamp01(1f - Mathf.Abs(distance - RingEdge) / band);
                return line * line;
            }, new Vector2(0.5f, 0.5f));
        }

        /// <summary>
        /// A vertical bar of light, pivot at the foot: full width top to bottom rather than
        /// tapering, so it reads as a standing shaft rather than as a blade or a ray.
        /// </summary>
        private static Sprite BeamSprite
        {
            get
            {
                if (beamSprite != null)
                    return beamSprite;

                beamSprite = Bake((dx, dy) =>
                {
                    var along = (dy + 1f) * 0.5f; // 0 at the foot, 1 at the tip
                    var across = dx;

                    var side = Mathf.Pow(Mathf.Clamp01(1f - Mathf.Abs(across) / 0.5f), 2.2f);
                    var length = Mathf.Pow(Mathf.Clamp01(1f - along), 0.6f);
                    var foot = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(along / 0.06f));

                    return side * length * foot;
                }, new Vector2(0.5f, 0f));
                return beamSprite;
            }
        }

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
