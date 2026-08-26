using Assets.Scripts.UI.ConfigWindow;
using UnityEngine;

namespace Assets.Scripts.Rendering
{
    /// <summary>
    /// Puts the saved picture settings on at startup and keeps them on.
    /// </summary>
    /// <remarks>
    /// Runs before anything else asks for a frame, so the first map is drawn at the settings
    /// that were chosen rather than at full size and then dropped a second later.
    ///
    /// It has to keep watch as well as set. The sun is part of the map, not part of the
    /// scene, so walking through a warp replaces the light whose shadows were switched off
    /// and they come back on with the new one. Cheaper to notice the light has gone than to
    /// find every place a map can be loaded from and remember to call in from each.
    /// </remarks>
    public class GraphicsQualityRunner : MonoBehaviour
    {
        private const float CheckInterval = 1f;

        private float timer;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (FindFirstObjectByType<GraphicsQualityRunner>() != null)
                return;

            var host = new GameObject("GraphicsQuality");
            DontDestroyOnLoad(host);
            host.AddComponent<GraphicsQualityRunner>();
        }

        private void Start()
        {
            GameConfig.InitializeIfNecessary();
            GraphicsQuality.ApplySaved();
            PerformanceOverlay.SetVisible(GameConfig.Data != null && GameConfig.Data.ShowFpsCounter);
        }

        private void Update()
        {
            timer -= Time.unscaledDeltaTime;
            if (timer > 0f)
                return;

            timer = CheckInterval;

            if (GraphicsQuality.NeedsMapReapply())
                GraphicsQuality.ReapplyForNewMap();
        }

        /// <summary>
        /// Puts the pipeline asset back before the editor writes it out. Only the editor
        /// needs this - a build's copy is thrown away with the process.
        /// </summary>
        private void OnApplicationQuit()
        {
            GraphicsQuality.RestoreEditorDefaults();
        }
    }
}
