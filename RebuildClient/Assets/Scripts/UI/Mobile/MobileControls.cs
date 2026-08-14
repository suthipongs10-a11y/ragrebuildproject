using System.Collections.Generic;
using Assets.Scripts.MapEditor;
using Assets.Scripts.Network;
using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
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
        private const float TalkSearchRange = 15f;
        private const int MinimapPixels = 240;
        private const int MaxEnemyBlips = 40;
        private const float BlipRefreshInterval = 0.2f;

        //the bottom menu wraps to this many buttons per row so it fits a phone screen
        private const int MenuColumns = 5;
        private const float MenuCellWidth = 100f;
        private const float MenuCellHeight = 30f;
        private const float MenuSpacing = 4f;

        private static readonly Color AttackColor = new Color(0.78f, 0.20f, 0.20f, 0.45f);
        private static readonly Color PickUpColor = new Color(0.18f, 0.60f, 0.30f, 0.45f);
        private static readonly Color ZoomColor = new Color(0.25f, 0.28f, 0.35f, 0.35f);
        private static readonly Color TalkColor = new Color(0.85f, 0.60f, 0.20f, 0.45f);
        private static readonly Color WalkableColor = new Color(0.55f, 0.62f, 0.45f, 0.85f);
        private static readonly Color BlockedColor = new Color(0.12f, 0.13f, 0.15f, 0.85f);

        private RectTransform controlGroup;
        private RectTransform minimapArea;
        private RawImage minimapImage;
        private Texture2D minimapTexture;
        private RectTransform playerBlip;
        private readonly List<RectTransform> enemyBlips = new List<RectTransform>();

        private Sprite circleSprite;
        private string builtMapName = "";
        private float blipTimer;
        private GridLayoutGroup menuGrid;
        private RectTransform menuRect;
        private float menuFitWidth = -1f;

        private JoystickPad joystick;
        private Vector2Int lastWalkDirection;
        private float walkResendTimer;
        private bool joystickWalking;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

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

            //everything except the toggle lives in here so one call can hide the lot
            var groupObject = new GameObject("Controls", typeof(RectTransform));
            groupObject.transform.SetParent(root, false);
            controlGroup = groupObject.GetComponent<RectTransform>();
            controlGroup.anchorMin = Vector2.zero;
            controlGroup.anchorMax = Vector2.one;
            controlGroup.offsetMin = Vector2.zero;
            controlGroup.offsetMax = Vector2.zero;

            CreateButton(controlGroup, new Vector2(-110, 250), 170, AttackColor, CreateSwordSprite(), OnAttack);
            CreateButton(controlGroup, new Vector2(-110, 440), 140, PickUpColor, CreateHandSprite(), OnPickUp);
            CreateButton(controlGroup, new Vector2(-110, 610), 100, ZoomColor, null, () => Zoom(-6f), "+");
            CreateButton(controlGroup, new Vector2(-110, 720), 100, ZoomColor, null, () => Zoom(6f), "-");
            CreateButton(controlGroup, new Vector2(-300, 250), 120, TalkColor, null, OnTalk, "...");
            CreateButton(controlGroup, new Vector2(-300, 400), 120, ZoomColor, null, OnSit, "Zz");
            CreateButton(controlGroup, new Vector2(-300, 550), 100, ZoomColor, null, PressEscape, "ESC");
            CreateButton(controlGroup, new Vector2(-300, 680), 100, ZoomColor, null, ToggleFullscreen, "[  ]");

            CreateJoystick(controlGroup);
            CreateButton(controlGroup, new Vector2(45, 560), 90, ZoomColor, null, () => RotateCamera(-45f), "<", true);
            CreateButton(controlGroup, new Vector2(145, 560), 90, ZoomColor, null, ResetCamera, "o", true);
            CreateButton(controlGroup, new Vector2(245, 560), 90, ZoomColor, null, () => RotateCamera(45f), ">", true);
            CreateButton(controlGroup, new Vector2(45, 670), 90, TalkColor, null, OpenChat, "Chat", true);
            CreateButton(controlGroup, new Vector2(145, 670), 90, TalkColor, null, OpenChatRoomCommand, "Room", true);

            CreateMinimap(controlGroup);

            CreateButton(root, new Vector2(-20, 130), 70, ZoomColor, CreateMenuSprite(), ToggleControls);
        }

        private void Update()
        {
            RestructureBottomMenu();
            UpdateJoystickWalk();
            RefreshMinimapForCurrentMap();

            blipTimer -= Time.deltaTime;
            if (blipTimer > 0)
                return;

            blipTimer = BlipRefreshInterval;
            RefreshBlips();
        }

        /// <summary>
        /// The bottom menu is one long row anchored to the bottom right corner, so on a
        /// phone the leftmost buttons (Stats, Skills, Inventory) hang off the screen.
        /// Scaling can't fix it because CameraFollower.UpdateCameraSize reapplies the
        /// configured MasterUIScale, so instead the row is rebuilt as a grid that wraps
        /// into two rows sized to the actual screen.
        /// </summary>
        private void RestructureBottomMenu()
        {
            if (menuGrid == null)
            {
                foreach (var layout in FindObjectsByType<HorizontalLayoutGroup>(FindObjectsSortMode.None))
                {
                    var bar = layout.transform;
                    if (bar.Find("Database") == null || bar.Find("Hotbar") == null || bar.Find("Stats") == null)
                        continue;

                    Destroy(layout);
                    menuRect = (RectTransform)bar;
                    menuGrid = bar.gameObject.AddComponent<GridLayoutGroup>();
                    menuGrid.spacing = new Vector2(MenuSpacing, MenuSpacing);
                    menuGrid.startCorner = GridLayoutGroup.Corner.UpperLeft;
                    menuGrid.startAxis = GridLayoutGroup.Axis.Horizontal;
                    menuGrid.childAlignment = TextAnchor.UpperCenter;
                    menuGrid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
                    menuGrid.constraintCount = MenuColumns;

                    //long labels like Equipment must shrink to fit a narrow cell, not clip
                    foreach (var label in bar.GetComponentsInChildren<TMP_Text>(true))
                    {
                        label.fontSizeMax = label.fontSize;
                        label.fontSizeMin = 8;
                        label.enableAutoSizing = true;
                    }

                    Debug.Log("[MobileControls] Wrapped the bottom menu into two rows.");
                    break;
                }

                if (menuGrid == null)
                    return;
            }

            //cells are sized off the real screen, so redo them when it rotates or rescales
            var canvas = menuRect.GetComponentInParent<Canvas>();
            var scale = canvas != null && canvas.scaleFactor > 0 ? canvas.scaleFactor : 1f;
            var available = Screen.width / scale - 20f;
            if (Mathf.Approximately(available, menuFitWidth))
                return;
            menuFitWidth = available;

            var cell = Mathf.Min(MenuCellWidth, (available - (MenuColumns - 1) * MenuSpacing) / MenuColumns);
            menuGrid.cellSize = new Vector2(cell, MenuCellHeight);

            menuRect.anchorMin = new Vector2(1f, 0f);
            menuRect.anchorMax = new Vector2(1f, 0f);
            menuRect.pivot = new Vector2(1f, 0f);
            menuRect.sizeDelta = new Vector2(cell * MenuColumns + (MenuColumns - 1) * MenuSpacing, MenuCellHeight * 2 + MenuSpacing);
            menuRect.anchoredPosition = new Vector2(-10f, 8f);
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

        /// <summary>
        /// Talks to the closest NPC. Portals count as npcs but have no click handler,
        /// so the server simply ignores the click if one happens to be nearest.
        /// </summary>
        private void OnTalk()
        {
            var player = PlayerObject();
            if (player == null)
                return;

            ServerControllable best = null;
            var bestDistance = TalkSearchRange;

            foreach (var entity in NetworkManager.Instance.EntityList.Values)
            {
                if (entity == null || entity.CharacterType != CharacterType.NPC || !entity.IsInteractable || entity.IsHidden)
                    continue;

                var distance = Vector3.Distance(player.transform.position, entity.transform.position);
                if (distance >= bestDistance)
                    continue;

                best = entity;
                bestDistance = distance;
            }

            if (best != null)
                NetworkManager.Instance.SendNpcClick(best.Id);
        }

        /// <summary>
        /// Walks the player in the direction the joystick is held, reusing the same
        /// direction packets and resend cadence as desktop WASD movement. The angle is
        /// offset by the camera rotation so pushing up always walks away from the camera.
        /// </summary>
        private void UpdateJoystickWalk()
        {
            if (joystick == null)
                return;

            var held = joystick.Active && joystick.Value.sqrMagnitude > 0.05f;
            if (!held)
            {
                if (joystickWalking)
                {
                    NetworkManager.Instance.StopPlayer();
                    joystickWalking = false;
                    lastWalkDirection = Vector2Int.zero;
                }
                return;
            }

            var camera = CameraFollower.Instance;
            if (camera == null || camera.TargetControllable == null)
                return;

            //the x axis is mirrored on purpose, the wasd path feeds mirrored east/west
            //into this same math (see GetWASDKeyPress) and GetFacingForAngle undoes it
            var push = joystick.Value;
            var angle = Mathf.Atan2(-push.x, push.y) * Mathf.Rad2Deg - camera.Rotation;
            angle = Mathf.Repeat(angle + 180f, 360f) - 180f;
            var facing = Directions.GetFacingForAngle(angle);
            var step = Directions.GetXYForDirection(facing);
            var direction = new Vector2Int(step.x, step.y);

            walkResendTimer -= Time.deltaTime;
            if (direction != lastWalkDirection)
                walkResendTimer = -1f;
            if (walkResendTimer > 0)
                return;

            NetworkManager.Instance.MovePlayerInDirection(direction);
            lastWalkDirection = direction;
            walkResendTimer = 0.30f;
            joystickWalking = true;
        }

        private void RotateCamera(float amount)
        {
            var camera = CameraFollower.Instance;
            if (camera != null)
                camera.TargetRotation += amount;
        }

        private void ResetCamera()
        {
            var camera = CameraFollower.Instance;
            if (camera == null)
                return;

            camera.TargetRotation = 0;
            camera.Height = 50;
            camera.Distance = 60;
        }

        private void OpenChat()
        {
            var camera = CameraFollower.Instance;
            if (camera == null || camera.TextBoxInputField == null)
                return;

            camera.TextBoxInputField.ActivateInputField();
        }

        /// <summary>
        /// Prefills the chat room command. Typing a title after it opens a room,
        /// sending it bare leaves or closes the one you're in.
        /// </summary>
        private void OpenChatRoomCommand()
        {
            var camera = CameraFollower.Instance;
            if (camera == null || camera.TextBoxInputField == null)
                return;

            camera.TextBoxInputField.text = "/chat ";
            camera.TextBoxInputField.ActivateInputField();
            camera.TextBoxInputField.caretPosition = camera.TextBoxInputField.text.Length;
        }

        private void PressEscape()
        {
            if (UiManager.Instance != null)
                UiManager.Instance.CloseLastWindow();
        }

        private void ToggleFullscreen()
        {
            Screen.fullScreen = !Screen.fullScreen;
        }

        private void OnSit()
        {
            var camera = CameraFollower.Instance;
            var controllable = camera == null ? null : camera.TargetControllable;
            if (controllable == null || controllable.SpriteAnimator == null)
                return;

            var state = controllable.SpriteAnimator.State;
            if (state == SpriteState.Idle || state == SpriteState.Standby)
                NetworkManager.Instance.ChangePlayerSitStand(true);
            else if (state == SpriteState.Sit)
                NetworkManager.Instance.ChangePlayerSitStand(false);
        }

        private void ToggleControls()
        {
            controlGroup.gameObject.SetActive(!controlGroup.gameObject.activeSelf);
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
                new Vector2(MinimapPixels, MinimapPixels), new Color(0, 0, 0, 0.3f));

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

        private void CreateButton(RectTransform root, Vector2 offset, float size, Color color, Sprite icon,
            UnityEngine.Events.UnityAction action, string label = null, bool leftSide = false)
        {
            var buttonObject = new GameObject("MobileButton", typeof(Image), typeof(Button));
            buttonObject.transform.SetParent(root, false);

            var image = buttonObject.GetComponent<Image>();
            image.sprite = circleSprite;
            image.color = color;

            var corner = leftSide ? new Vector2(0, 0) : new Vector2(1, 0);
            var rect = buttonObject.GetComponent<RectTransform>();
            rect.anchorMin = corner;
            rect.anchorMax = corner;
            rect.pivot = corner;
            rect.sizeDelta = new Vector2(size, size);
            rect.anchoredPosition = offset;

            buttonObject.GetComponent<Button>().onClick.AddListener(action);

            if (icon != null)
            {
                var iconObject = new GameObject("Icon", typeof(Image));
                iconObject.transform.SetParent(rect, false);

                var iconImage = iconObject.GetComponent<Image>();
                iconImage.sprite = icon;
                iconImage.color = new Color(1, 1, 1, 0.9f);
                iconImage.raycastTarget = false;

                var iconRect = iconObject.GetComponent<RectTransform>();
                iconRect.anchorMin = new Vector2(0.5f, 0.5f);
                iconRect.anchorMax = new Vector2(0.5f, 0.5f);
                iconRect.sizeDelta = new Vector2(size * 0.55f, size * 0.55f);
                return;
            }

            var font = TMP_Settings.defaultFontAsset;
            if (font == null || string.IsNullOrEmpty(label))
                return;

            var textObject = new GameObject("Label", typeof(TextMeshProUGUI));
            textObject.transform.SetParent(rect, false);

            var text = textObject.GetComponent<TextMeshProUGUI>();
            text.font = font;
            text.text = label;
            text.alignment = TextAlignmentOptions.Center;
            text.fontSize = size * (label.Length > 2 ? 0.28f : 0.4f);
            text.color = new Color(1, 1, 1, 0.9f);
            text.raycastTarget = false;

            var textRect = textObject.GetComponent<RectTransform>();
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;
        }

        /// <summary>
        /// A drag pad in the bottom left corner that walks the player like WASD does.
        /// The pad tracks the finger, UpdateJoystickWalk turns it into move packets.
        /// </summary>
        private void CreateJoystick(RectTransform root)
        {
            var padObject = new GameObject("Joystick", typeof(Image), typeof(JoystickPad));
            padObject.transform.SetParent(root, false);

            var padImage = padObject.GetComponent<Image>();
            padImage.sprite = circleSprite;
            padImage.color = new Color(0.25f, 0.28f, 0.35f, 0.25f);

            var padRect = padObject.GetComponent<RectTransform>();
            padRect.anchorMin = Vector2.zero;
            padRect.anchorMax = Vector2.zero;
            padRect.pivot = new Vector2(0.5f, 0.5f);
            padRect.sizeDelta = new Vector2(270, 270);
            padRect.anchoredPosition = new Vector2(180, 340);

            var knobObject = new GameObject("Knob", typeof(Image));
            knobObject.transform.SetParent(padRect, false);

            var knobImage = knobObject.GetComponent<Image>();
            knobImage.sprite = circleSprite;
            knobImage.color = new Color(1f, 1f, 1f, 0.35f);
            knobImage.raycastTarget = false;

            var knobRect = knobObject.GetComponent<RectTransform>();
            knobRect.anchorMin = new Vector2(0.5f, 0.5f);
            knobRect.anchorMax = new Vector2(0.5f, 0.5f);
            knobRect.sizeDelta = new Vector2(115, 115);

            joystick = padObject.GetComponent<JoystickPad>();
            joystick.Knob = knobRect;
            joystick.Radius = 85f;
        }

        private class JoystickPad : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
        {
            public RectTransform Knob;
            public float Radius = 85f;
            public Vector2 Value;
            public bool Active;

            public void OnPointerDown(PointerEventData eventData)
            {
                Active = true;
                MoveKnob(eventData);
            }

            public void OnDrag(PointerEventData eventData) => MoveKnob(eventData);

            public void OnPointerUp(PointerEventData eventData)
            {
                Active = false;
                Value = Vector2.zero;
                if (Knob != null)
                    Knob.anchoredPosition = Vector2.zero;
            }

            private void MoveKnob(PointerEventData eventData)
            {
                RectTransformUtility.ScreenPointToLocalPointInRectangle((RectTransform)transform,
                    eventData.position, eventData.pressEventCamera, out var local);

                var clamped = Vector2.ClampMagnitude(local, Radius);
                Value = clamped / Radius;
                if (Knob != null)
                    Knob.anchoredPosition = clamped;
            }
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

        //---------------------------------------------------------------- generated art

        private const int IconResolution = 64;

        private static Sprite CreateCircleSprite()
        {
            var pixels = NewTransparentBuffer();
            var center = (IconResolution - 1) * 0.5f;
            var radius = center - 0.5f;

            for (var y = 0; y < IconResolution; y++)
            {
                for (var x = 0; x < IconResolution; x++)
                {
                    var distance = Vector2.Distance(new Vector2(x, y), new Vector2(center, center));
                    pixels[y * IconResolution + x] = new Color(1, 1, 1, Mathf.Clamp01(radius - distance));
                }
            }

            return BuildSprite(pixels);
        }

        private static Sprite CreateSwordSprite()
        {
            var pixels = NewTransparentBuffer();

            FillRect(pixels, 28, 30, 36, 54, Color.white); //blade
            FillRect(pixels, 30, 54, 34, 59, Color.white); //point
            FillRect(pixels, 18, 25, 46, 30, Color.white); //crossguard
            FillRect(pixels, 30, 11, 34, 25, Color.white); //grip
            FillRect(pixels, 27, 6, 37, 11, Color.white);  //pommel

            return BuildSprite(pixels);
        }

        private static Sprite CreateHandSprite()
        {
            var pixels = NewTransparentBuffer();

            FillRect(pixels, 20, 8, 44, 34, Color.white);  //palm
            FillRect(pixels, 21, 34, 26, 48, Color.white); //fingers
            FillRect(pixels, 27, 34, 32, 52, Color.white);
            FillRect(pixels, 33, 34, 38, 50, Color.white);
            FillRect(pixels, 39, 34, 44, 45, Color.white);
            FillRect(pixels, 13, 20, 20, 31, Color.white); //thumb

            return BuildSprite(pixels);
        }

        private static Sprite CreateMenuSprite()
        {
            var pixels = NewTransparentBuffer();

            FillRect(pixels, 14, 42, 50, 49, Color.white);
            FillRect(pixels, 14, 29, 50, 36, Color.white);
            FillRect(pixels, 14, 16, 50, 23, Color.white);

            return BuildSprite(pixels);
        }

        private static Color[] NewTransparentBuffer()
        {
            var pixels = new Color[IconResolution * IconResolution];
            for (var i = 0; i < pixels.Length; i++)
                pixels[i] = new Color(1, 1, 1, 0);

            return pixels;
        }

        private static void FillRect(Color[] pixels, int left, int bottom, int right, int top, Color color)
        {
            for (var y = Mathf.Max(0, bottom); y < Mathf.Min(IconResolution, top); y++)
            {
                for (var x = Mathf.Max(0, left); x < Mathf.Min(IconResolution, right); x++)
                    pixels[y * IconResolution + x] = color;
            }
        }

        private static Sprite BuildSprite(Color[] pixels)
        {
            var texture = new Texture2D(IconResolution, IconResolution, TextureFormat.RGBA32, false);
            texture.SetPixels(pixels);
            texture.Apply();

            return Sprite.Create(texture, new Rect(0, 0, IconResolution, IconResolution), new Vector2(0.5f, 0.5f));
        }
    }
}
