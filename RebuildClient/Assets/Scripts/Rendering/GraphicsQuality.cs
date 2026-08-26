using Assets.Scripts.UI.ConfigWindow;
using Assets.Scripts.UI.Mobile;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Assets.Scripts.Rendering
{
    /// <summary>
    /// The one place that turns a chosen picture quality into the settings that produce it.
    /// </summary>
    /// <remarks>
    /// Written because a phone is not one machine. The same build has to run on something
    /// three years old with two gigabytes of memory and on something that could run it four
    /// times over, and there is no single set of settings that is right for both: what keeps
    /// the old one above thirty frames looks needlessly plain on the new one.
    ///
    /// Every switch here is a real one with a measurable cost. In rough order of what it
    /// buys back on a phone:
    ///
    ///  - Render scale. The world is drawn into a buffer this fraction of the screen and
    ///    stretched back up; the interface stays at full size, drawn afterwards. A phone
    ///    screen is two to three million pixels and almost all of the time goes into filling
    ///    them, so three quarters scale is roughly half the pixel work. Nothing else here
    ///    comes close.
    ///  - Shadows. The one real-time light casts a shadow map, which is the whole map drawn
    ///    a second time before the frame proper. Turning it off removes that pass outright.
    ///  - HDR. Costs a wider frame buffer to hold colours brighter than white, which a game
    ///    drawn from flat sprites has none of. Pure bandwidth, and bandwidth is what a phone
    ///    is short of.
    ///  - Texture size. The only setting here that gives memory back rather than time: half
    ///    size is a quarter of the memory. This is the one to reach for on a device that
    ///    crashes or reloads the tab rather than one that merely stutters.
    ///  - Water, map effects, other players. Each removes work in proportion to how much of
    ///    it is on screen, which in a town is a great deal and in a field is nothing.
    ///
    /// The pipeline asset is a file in the project, so changing it in the editor would
    /// otherwise leave the change sitting in the project afterwards. The values it arrived
    /// with are kept and put back on quit - see RestoreEditorDefaults.
    /// </remarks>
    public static class GraphicsQuality
    {
        public const int PresetHigh = 0;
        public const int PresetMedium = 1;
        public const int PresetLow = 2;
        public const int PresetMinimum = 3;
        public const int PresetCustom = 4;

        public static readonly string[] PresetNames = { "สูง", "กลาง", "ต่ำ", "ประหยัดสุด", "กำหนดเอง" };

        /// <summary>Read every frame by ServerControllable, so switching it takes effect at once.</summary>
        public static bool ShowOtherPlayers = true;

        private static bool pristineCaptured;
        private static float pristineRenderScale;
        private static bool pristineHdr;
        private static float pristineShadowDistance;
        private static int pristineMipmapLimit;

        private static UniversalRenderPipelineAsset Pipeline =>
            GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;

        // =====================================================================
        // Presets

        /// <summary>Writes a preset's values into the saved config, without applying them.</summary>
        public static void FillFromPreset(GameConfigData data, int preset)
        {
            data.GraphicsPreset = preset;

            switch (preset)
            {
                case PresetHigh:
                    data.RenderScale = 1f;
                    data.EnableShadows = true;
                    data.EnableHdr = true;
                    data.EnableWaterReflection = true;
                    data.EnableMapEffects = true;
                    data.ShowOtherPlayers = true;
                    data.ThrottleDistantAnimation = false;
                    data.HalfTextureMemory = false;
                    data.FrameRateCap = 0;
                    break;

                case PresetMedium:
                    data.RenderScale = 0.85f;
                    data.EnableShadows = false;
                    data.EnableHdr = false;
                    data.EnableWaterReflection = true;
                    data.EnableMapEffects = true;
                    data.ShowOtherPlayers = true;
                    data.ThrottleDistantAnimation = true;
                    data.HalfTextureMemory = false;
                    data.FrameRateCap = 60;
                    break;

                case PresetLow:
                    data.RenderScale = 0.7f;
                    data.EnableShadows = false;
                    data.EnableHdr = false;
                    data.EnableWaterReflection = false;
                    data.EnableMapEffects = false;
                    data.ShowOtherPlayers = true;
                    data.ThrottleDistantAnimation = true;
                    data.HalfTextureMemory = true;
                    data.FrameRateCap = 60;
                    break;

                //Everything that is not a monster, an item on the ground or your own party.
                //For a device that is running out of memory rather than out of time, and for
                //a town square with sixty shops in it.
                case PresetMinimum:
                    data.RenderScale = 0.55f;
                    data.EnableShadows = false;
                    data.EnableHdr = false;
                    data.EnableWaterReflection = false;
                    data.EnableMapEffects = false;
                    data.ShowOtherPlayers = false;
                    data.ThrottleDistantAnimation = true;
                    data.HalfTextureMemory = true;
                    data.FrameRateCap = 30;
                    break;
            }
        }

        // =====================================================================
        // Applying

        /// <summary>
        /// Applies whatever is in the config, choosing a starting point first if this is the
        /// first run. A phone starts on Low and a desktop on High: guessing high on a phone
        /// means the first thing somebody sees is a slideshow, and by then they have decided
        /// what the game is.
        /// </summary>
        public static void ApplySaved()
        {
            var data = GameConfig.Data;
            if (data == null)
                return;

            if (data.GraphicsPreset < 0)
                FillFromPreset(data, MobileMode.IsActive ? PresetLow : PresetHigh);

            Apply(data);
        }

        public static void Apply(GameConfigData data)
        {
            if (data == null)
                return;

            CapturePristine();

            ShowOtherPlayers = data.ShowOtherPlayers;

            ApplyPipeline(data);
            ApplyShadows(data.EnableShadows);
            ApplyTextureMemory(data.HalfTextureMemory);
            ApplyFrameRateCap(data.FrameRateCap);
            ApplyWaterPass(data.EnableWaterReflection);
            ApplyAnimationThrottle(data.ThrottleDistantAnimation);
            ApplyMapEffects(data.EnableMapEffects);
        }

        private static void CapturePristine()
        {
            if (pristineCaptured)
                return;

            pristineCaptured = true;
            pristineMipmapLimit = QualitySettings.globalTextureMipmapLimit;

            var urp = Pipeline;
            if (urp == null)
                return;

            pristineRenderScale = urp.renderScale;
            pristineHdr = urp.supportsHDR;
            pristineShadowDistance = urp.shadowDistance;
        }

        /// <summary>
        /// Puts the pipeline asset back the way it was found. Editor only, and only because
        /// the asset is a file: a play session left on Minimum would otherwise show up as a
        /// change to the project afterwards, and get committed by somebody who never chose it.
        /// </summary>
        public static void RestoreEditorDefaults()
        {
            if (!Application.isEditor || !pristineCaptured)
                return;

            QualitySettings.globalTextureMipmapLimit = pristineMipmapLimit;

            var urp = Pipeline;
            if (urp == null)
                return;

            urp.renderScale = pristineRenderScale;
            urp.supportsHDR = pristineHdr;
            urp.shadowDistance = pristineShadowDistance;
        }

        private static void ApplyPipeline(GameConfigData data)
        {
            var urp = Pipeline;
            if (urp == null)
                return;

            urp.renderScale = Mathf.Clamp(data.RenderScale, 0.4f, 1f);
            urp.supportsHDR = data.EnableHdr;

            //Not zero. URP treats a distance of nothing as a shadow map it still has to set
            //up, and some versions warn about it every frame; a metre of it costs nothing and
            //the light being switched off below is what actually removes the pass.
            urp.shadowDistance = data.EnableShadows ? Mathf.Max(pristineShadowDistance, 1f) : 1f;
        }

        private static Light appliedSun;

        private static void ApplyShadows(bool enabled)
        {
            var light = CurrentSunLight();
            appliedSun = light;

            if (light == null)
                return;

            //Whatever the map's own light was set to is kept when shadows are on; only a
            //light we switched off ourselves is guessed back to soft, because by then there
            //is nothing left to read the original off.
            if (!enabled)
                light.shadows = LightShadows.None;
            else if (light.shadows == LightShadows.None)
                light.shadows = LightShadows.Soft;
        }

        private static Light CurrentSunLight()
        {
            //The map builder names it this. RenderSettings.sun is set from the scene's own
            //lighting settings and is the cheaper answer when there is one.
            var sun = RenderSettings.sun;
            if (sun != null)
                return sun;

            var found = GameObject.Find("DirectionalLight");
            return found != null ? found.GetComponent<Light>() : null;
        }

        /// <summary>
        /// Whether the light the shadow setting was last put on is still the one lighting the
        /// map. Walking through a warp replaces the map and its sun with it, and the new one
        /// arrives with shadows switched back on.
        /// </summary>
        /// <remarks>
        /// Compared by identity rather than by "is there one", so a title screen with no map
        /// at all settles at no light applied to no light and stops asking.
        /// </remarks>
        public static bool NeedsMapReapply() => CurrentSunLight() != appliedSun;

        /// <summary>Re-applies the settings that belong to the map rather than to the device.</summary>
        public static void ReapplyForNewMap()
        {
            var data = GameConfig.Data;
            if (data == null)
                return;

            ApplyShadows(data.EnableShadows);
            ApplyMapEffects(data.EnableMapEffects);
        }

        private static void ApplyTextureMemory(bool half)
        {
            //1 is "drop the top mip", which is half the width and height and so a quarter of
            //the memory. Takes effect as textures are next uploaded rather than at once.
            QualitySettings.globalTextureMipmapLimit = half ? 1 : 0;
        }

        private static void ApplyFrameRateCap(int cap)
        {
            //A cap is not only about battery. A device that can manage forty frames but not
            //sixty spends every frame missing the target, and the unevenness reads as far
            //worse than a steady thirty does.
            Application.targetFrameRate = cap > 0 ? cap : -1;
        }

        private static void ApplyWaterPass(bool enabled)
        {
            if (RoWaterFeature.Instance != null)
                RoWaterFeature.Instance.SetActive(enabled);
        }

        private static void ApplyAnimationThrottle(bool throttle)
        {
            var batcher = RoSpriteAndGroundItemBatcher.Instance;
            if (batcher == null)
                return;

            batcher.EnableTickGroups = true;

            //How many animating things have to be on screen before the ones far from the
            //camera start being stepped every other frame instead of every frame. Left high
            //it only ever helps a town; brought down it helps a field full of monsters too.
            batcher.TickThreshold = throttle ? 40 : 200;
        }

        private static void ApplyMapEffects(bool enabled)
        {
            //Torches, sparkles, the things a map is decorated with. They are already culled
            //to what is on screen, so this is for a device where even that is too much.
            var manager = Object.FindFirstObjectByType<Assets.Scripts.Objects.SceneEffectCullingManager>();
            if (manager != null)
                manager.enabled = enabled;

            if (enabled)
                return;

            var spawners = Object.FindObjectsByType<Assets.Scripts.Effects.EffectSpawner>(
                FindObjectsInactive.Include, FindObjectsSortMode.None);
            for (var i = 0; i < spawners.Length; i++)
                spawners[i].gameObject.SetActive(false);
        }
    }
}
