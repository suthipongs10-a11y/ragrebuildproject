using System.Collections.Generic;
using Assets.Scripts.MapEditor;
using Assets.Scripts.Network;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Mobile
{
    /// <summary>
    /// Touch buttons and a minimap for phones and tablets. Everything is created from
    /// code so the shared scene and prefabs stay untouched, and the whole thing only
    /// spawns on a device that actually reports touch input.
    /// </summary>
    public class MobileControls : MonoBehaviour
    {
        private const float TargetSearchRange = 40f;
        private const float PickUpSearchRange = 20f;
        private const int MinimapPixels = 240;
        private const int MaxEnemyBlips = 40;
        private const float BlipRefreshInterval = 0.2f;

        private static readonly Color WalkableColor = new Color(0.55f, 0.62f, 0.45f, 0.85f);
        private static readonly Color BlockedColor = new Color(0.12f, 0.13f, 0.15f, 0.85f);

        private RectTransform minimapArea;
        private RawImage minimapImage;
        private Texture2D minimapTexture;
        private RectTransform playerBlip;
        private readonly List<RectTransform> enemyBlips = new List<RectTransform>();

        private Sprite circleSprite;
        private string builtMapName = "";
        private float blipTimer;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!Input.touchSupported && !Application.isMobilePlatform)
                return;

            if (FindFirstObjectByType<MobileControls>() != null)
                return;

            var host = new GameObject("MobileControls");
            DontDestroyOnLoad(host);
            host.AddComponent<MobileControls>();
        }

        private void Awake()
        {
            circleSprite = CreateCircleSprite();

            var canvasObject = new GameObject("MobileCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false);

            var canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 500; //above the game's own windows

            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(720, 1280);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            var root = canvasObject.GetComponent<RectTransform>();

            CreateButton(root, "Attack", new Vector2(-110, 250), 170, new Color(0.72f, 0.18f, 0.18f, 0.8f), OnAttack);
            CreateButton(root, "Pick Up", new Vector2(-110, 440), 140, new Color(0.18f, 0.55f, 0.28f, 0.8f), OnPickUp);
            CreateButton(root, "+", new Vector2(-110, 610), 100, new Color(0.25f, 0.28f, 0.35f, 0.7f), () => Zoom(-6f));
            CreateButton(root, "-", new Vector2(-110, 720), 100, new Color(0.25f, 0.28f, 0.35f, 0.7f), () => Zoom(6f));

            CreateMinimap(root);
        }

        private void Update()
        {
            RefreshMinimapForCurrentMap();

            blipTimer -= Time.deltaTime;
            if (blipTimer > 0)
                return;

            blipTimer = BlipRefreshInterval;
            RefreshBlips();
        }

        //---------------------------------------------------------------- actions

        private void OnAttack()
        {
            var player = PlayerObject();
            if (player == null)
                return;

            ServerControllable best = null;
            var bestDistance = TargetSearchRange;

            foreach (var entity in NetworkManager.Instance.EntityList.Values)
            {
                if (!IsValidTarget(entity))
                    continue;

                var distance = Vector3.Distance(player.transform.position, entity.transform.position);
                if (distance >= bestDistance)
                    continue;

                best = entity;
                bestDistance = distance;
            }

            if (best != null)
                NetworkManager.Instance.SendAttack(best.Id);
        }

        /// <summary>
        /// Mirrors the canClickEnemy test in CameraFollower. A monster is not flagged
        /// IsAttackable, that flag is only set on traps, so what actually marks a valid
        /// target is being a non-NPC the server told us we may interact with.
        /// </summary>
        private static bool IsValidTarget(ServerControllable entity)
        {
            if (entity == null || entity.IsMainCharacter || !entity.IsCharacterAlive || entity.IsHidden || entity.IsAlly)
                return false;

            return (entity.CharacterType != CharacterType.NPC && entity.IsInteractable) || entity.IsAttackable;
        }

        private void OnPickUp()
        {
            var player = PlayerObject();
            if (player == null)
                return;

            GroundItem best = null;
            var bestDistance = PickUpSearchRange;

            foreach (var item in FindObjectsByType<GroundItem>(FindObjectsSortMode.None))
            {
                var distance = Vector3.Distance(player.transform.position, item.transform.position);
                if (distance >= bestDistance)
                    continue;

                best = item;
                bestDistance = distance;
            }

            if (best != null)
                NetworkManager.Instance.SendPickUpItem(best.EntityId);
        }

        private void Zoom(float amount)
        {
            var camera = CameraFollower.Instance;
            if (camera != null)
                camera.Distance += amount;
        }

        //---------------------------------------------------------------- minimap

        private void CreateMinimap(RectTransform root)
        {
            minimapArea = CreatePanel(root, "Minimap", new Vector2(1, 1), new Vector2(-20, -20),
                new Vector2(MinimapPixels, MinimapPixels), new Color(0, 0, 0, 0.35f));

            var imageObject = new GameObject("MinimapImage", typeof(RawImage));
            imageObject.transform.SetParent(minimapArea, false);
            minimapImage = imageObject.GetComponent<RawImage>();
            minimapImage.raycastTarget = false;

            var imageRect = imageObject.GetComponent<RectTransform>();
            imageRect.anchorMin = Vector2.zero;
            imageRect.anchorMax = Vector2.one;
            imageRect.offsetMin = new Vector2(4, 4);
            imageRect.offsetMax = new Vector2(-4, -4);

            playerBlip = CreateBlip(minimapArea, new Color(1f, 1f, 0.3f, 1f), 14);
        }

        private void RefreshMinimapForCurrentMap()
        {
            var map = NetworkManager.Instance == null ? "" : NetworkManager.Instance.CurrentMap;
            if (string.IsNullOrEmpty(map) || map == builtMapName)
                return;

            var walkData = RoWalkDataProvider.Instance;
            if (walkData == null || walkData.WalkData == null)
                return;

            var width = walkData.WalkData.Width;
            var height = walkData.WalkData.Height;
            if (width <= 0 || height <= 0)
                return;

            if (minimapTexture != null)
                Destroy(minimapTexture);

            minimapTexture = new Texture2D(width, height, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp
            };

            var pixels = new Color32[width * height];
            for (var y = 0; y < height; y++)
            {
                for (var x = 0; x < width; x++)
                    pixels[y * width + x] = walkData.IsCellWalkable(new Vector2Int(x, y)) ? WalkableColor : BlockedColor;
            }

            minimapTexture.SetPixels32(pixels);
            minimapTexture.Apply();

            minimapImage.texture = minimapTexture;
            builtMapName = map;
        }

        private void RefreshBlips()
        {
            var player = PlayerObject();
            var walkData = RoWalkDataProvider.Instance;

            if (player == null || walkData == null || walkData.WalkData == null || minimapTexture == null)
            {
                playerBlip.gameObject.SetActive(false);
                for (var i = 0; i < enemyBlips.Count; i++)
                    enemyBlips[i].gameObject.SetActive(false);
                return;
            }

            playerBlip.gameObject.SetActive(true);
            playerBlip.anchoredPosition = MinimapPosition(walkData, player.transform.position);

            var used = 0;
            foreach (var entity in NetworkManager.Instance.EntityList.Values)
            {
                if (used >= MaxEnemyBlips)
                    break;

                if (!IsValidTarget(entity))
                    continue;

                while (enemyBlips.Count <= used)
                    enemyBlips.Add(CreateBlip(minimapArea, new Color(1f, 0.35f, 0.35f, 1f), 10));

                var blip = enemyBlips[used];
                blip.gameObject.SetActive(true);
                blip.anchoredPosition = MinimapPosition(walkData, entity.transform.position);
                used++;
            }

            for (var i = used; i < enemyBlips.Count; i++)
                enemyBlips[i].gameObject.SetActive(false);
        }

        private Vector2 MinimapPosition(RoWalkDataProvider walkData, Vector3 worldPosition)
        {
            var cell = walkData.GetTilePositionForPoint(worldPosition);
            var width = Mathf.Max(1, walkData.WalkData.Width);
            var height = Mathf.Max(1, walkData.WalkData.Height);

            //the image is inset by four units on every side, so match that here
            var usable = MinimapPixels - 8f;
            var x = (cell.x / (float)width - 0.5f) * usable;
            var y = (cell.y / (float)height - 0.5f) * usable;

            return new Vector2(x, y);
        }

        //---------------------------------------------------------------- widgets

        private GameObject PlayerObject()
        {
            var camera = CameraFollower.Instance;
            return camera == null ? null : camera.Target;
        }

        private void CreateButton(RectTransform root, string label, Vector2 offset, float size, Color color, UnityEngine.Events.UnityAction action)
        {
            var buttonObject = new GameObject("Button" + label, typeof(Image), typeof(Button));
            buttonObject.transform.SetParent(root, false);

            var image = buttonObject.GetComponent<Image>();
            image.sprite = circleSprite;
            image.color = color;

            var rect = buttonObject.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(1, 0);
            rect.anchorMax = new Vector2(1, 0);
            rect.pivot = new Vector2(1, 0);
            rect.sizeDelta = new Vector2(size, size);
            rect.anchoredPosition = offset;

            buttonObject.GetComponent<Button>().onClick.AddListener(action);

            var font = TMP_Settings.defaultFontAsset;
            if (font == null)
                return;

            var textObject = new GameObject("Label", typeof(TextMeshProUGUI));
            textObject.transform.SetParent(rect, false);

            var text = textObject.GetComponent<TextMeshProUGUI>();
            text.font = font;
            text.text = label;
            text.alignment = TextAlignmentOptions.Center;
            text.fontSize = size * 0.24f;
            text.color = Color.white;
            text.raycastTarget = false;

            var textRect = textObject.GetComponent<RectTransform>();
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;
        }

        private RectTransform CreatePanel(RectTransform root, string name, Vector2 anchor, Vector2 offset, Vector2 size, Color color)
        {
            var panelObject = new GameObject(name, typeof(Image));
            panelObject.transform.SetParent(root, false);

            var image = panelObject.GetComponent<Image>();
            image.color = color;
            image.raycastTarget = false;

            var rect = panelObject.GetComponent<RectTransform>();
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.sizeDelta = size;
            rect.anchoredPosition = offset;

            return rect;
        }

        private RectTransform CreateBlip(RectTransform parent, Color color, float size)
        {
            var blipObject = new GameObject("Blip", typeof(Image));
            blipObject.transform.SetParent(parent, false);

            var image = blipObject.GetComponent<Image>();
            image.sprite = circleSprite;
            image.color = color;
            image.raycastTarget = false;

            var rect = blipObject.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.sizeDelta = new Vector2(size, size);

            return rect;
        }

        private static Sprite CreateCircleSprite()
        {
            const int resolution = 64;
            var texture = new Texture2D(resolution, resolution, TextureFormat.RGBA32, false);
            var center = (resolution - 1) * 0.5f;
            var radius = center - 0.5f;
            var pixels = new Color32[resolution * resolution];

            for (var y = 0; y < resolution; y++)
            {
                for (var x = 0; x < resolution; x++)
                {
                    var distance = Vector2.Distance(new Vector2(x, y), new Vector2(center, center));
                    var alpha = Mathf.Clamp01(radius - distance);
                    pixels[y * resolution + x] = new Color(1, 1, 1, alpha);
                }
            }

            texture.SetPixels32(pixels);
            texture.Apply();

            return Sprite.Create(texture, new Rect(0, 0, resolution, resolution), new Vector2(0.5f, 0.5f));
        }
    }
}
