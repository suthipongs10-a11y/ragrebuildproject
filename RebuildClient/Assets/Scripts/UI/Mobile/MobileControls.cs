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
    /// Touch buttons for phones and tablets. Everything is created from code so the shared
    /// scene and prefabs stay untouched, and the whole thing only spawns on a device that
    /// actually reports touch input.
    ///
    /// It is laid out twice, because a phone is held both ways and the two shapes have
    /// nothing in common. Upright there is height to spare and none to waste sideways, so
    /// the buttons stack three wide above the stick and the bottom menu wraps onto two
    /// rows. Turned over that block is taller than the screen, so it narrows to two columns
    /// down the left edge, the two action buttons sit side by side under the right thumb,
    /// and the menu straightens out into a single row along the bottom. Nothing is rebuilt
    /// when the phone turns - the same buttons are moved - so a rotation costs a few
    /// assignments rather than a rebuild.
    ///
    /// There is no minimap here. There was one, drawn from the walk data as a stand-in back
    /// when the game's own minimap could not be reached on a phone; the real one works there
    /// now, so the stand-in was a second map drawn over the first, on the only kind of screen
    /// with no room for either.
    /// </summary>
    public class MobileControls : MonoBehaviour
    {
        private const float TargetSearchRange = 40f;
        private const float PickUpSearchRange = 20f;
        private const float TalkSearchRange = 15f;

        //action buttons sit under the right thumb, everything else is grouped bottom left
        private const float AttackSize = 118f;
        private const float PickUpSize = 96f;
        private const float ToggleSize = 58f;
        private const float UtilSize = 68f;

        /// <summary>Small enough to sit inside the chat bar rather than over it.</summary>
        private const float SendSize = 40f;
        private const float UtilGap = 8f;
        private const float UtilOriginX = 24f;
        private const float UtilOriginY = 410f;

        /// <summary>How wide the block of small buttons is, held each way.</summary>
        private const int UtilColumns = 3;

        /// <summary>
        /// Sideways the block is three wide as well. It was two, which was right when there
        /// were twelve buttons and is a column longer than the screen now there are more.
        /// </summary>
        private const int LandscapeUtilColumns = 3;

        /// <summary>
        /// Where the block starts sideways: hard against the left edge, and low enough that
        /// the stick sits under it rather than in it.
        /// </summary>
        private const float LandscapeUtilOriginX = 16f;
        private const float LandscapeUtilOriginY = 208f;

        //the bottom menu wraps to this many buttons per row so it fits a phone screen
        private const int MenuColumns = 5;

        /// <summary>
        /// Sideways there is room for the lot in one row, which is worth having: two rows
        /// of menu is two rows of the map you are standing on that you cannot see.
        /// </summary>
        private const int LandscapeMenuColumns = 10;

        private const float MenuCellWidth = 100f;
        private const float MenuCellHeight = 30f;
        private const float MenuSpacing = 4f;

        /// <summary>The canvas is authored against a phone, one shape or the other.</summary>
        private static readonly Vector2 PortraitReference = new Vector2(720, 1280);
        private static readonly Vector2 LandscapeReference = new Vector2(1280, 720);

        //Nearly solid, and darker than they look here, because a touch control is drawn
        //over a bright green field in daylight on a screen held at arm's length. They were
        //painted at a third to a half opaque so as not to cover the game, and at that
        //strength they did not read as buttons at all - a grey ring you cannot see is worse
        //at not covering the game than one you can, because you hit it by accident.
        private static readonly Color AttackColor = new Color(0.62f, 0.13f, 0.13f, 0.88f);
        private static readonly Color PickUpColor = new Color(0.11f, 0.44f, 0.22f, 0.88f);
        private static readonly Color ZoomColor = new Color(0.13f, 0.16f, 0.22f, 0.85f);
        private static readonly Color TalkColor = new Color(0.66f, 0.42f, 0.09f, 0.88f);

        /// <summary>The rim every button wears, which is what gives it an edge to find.</summary>
        private static readonly Color RimColor = new Color(1f, 1f, 1f, 0.75f);

        private RectTransform controlGroup;

        private Sprite circleSprite;
        private Sprite ringSprite;
        private GridLayoutGroup menuGrid;
        private RectTransform menuRect;
        private float menuFitWidth = -1f;

        private JoystickPad joystick;
        private Vector2Int lastWalkDirection;
        private float walkResendTimer;
        private bool joystickWalking;

        private RectTransform toggleButton;
        private RectTransform sendButton;
        private bool wasInGame;

        /// <summary>
        /// The small buttons above the stick, in the order they were made. Their place in
        /// this list is their place in the block, so the same list lays out both shapes.
        /// </summary>
        private readonly System.Collections.Generic.List<RectTransform> utilButtons =
            new System.Collections.Generic.List<RectTransform>();

        private RectTransform attackButton;
        private RectTransform pickUpButton;
        private RectTransform joystickRect;
        private CanvasScaler scaler;

        /// <summary>Which way round everything is currently placed, so a turn is noticed.</summary>
        private bool laidOutLandscape;
        private bool hasLayout;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            //Asked of MobileMode rather than of the hardware: a desktop browser reports
            //touch support and used to end up with the phone's controls over its own.
            if (!MobileMode.IsActive)
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
            ringSprite = CreateRingSprite();

            var canvasObject = new GameObject("MobileCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false);

            var canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 500; //above the game's own windows

            scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = PortraitReference;
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

            //right thumb: the two buttons used constantly while fighting
            attackButton = CreateButton(controlGroup, new Vector2(-24, 170), AttackSize, AttackColor,
                CreateSwordSprite(), OnAttack);
            pickUpButton = CreateButton(controlGroup, new Vector2(-34, 300), PickUpSize, PickUpColor,
                CreateHandSprite(), OnPickUp);

            //left thumb: the stick, with every other control stacked above it
            CreateJoystick(controlGroup);

            //Made in reading order and placed afterwards, because where any of them goes
            //depends on which way the phone is being held. Their order here is their order
            //in the block, both ways round.
            AddUtil(TalkColor, null, OpenChat, ThaiUiText.Get("Chat"));
            AddUtil(TalkColor, null, OpenChatRoomCommand, ThaiUiText.Get("Room"));
            AddUtil(ZoomColor, null, PressEscape, "ESC");

            AddUtil(ZoomColor, null, ToggleFullscreen, "[ ]");
            AddUtil(ZoomColor, null, OnSit, "Zz");
            AddUtil(TalkColor, null, OnTalk, "...");

            AddUtil(ZoomColor, null, () => RotateCamera(-45f), "<");
            AddUtil(ZoomColor, null, ResetCamera, "o");
            AddUtil(ZoomColor, null, () => RotateCamera(45f), ">");

            AddUtil(ZoomColor, null, () => Zoom(-6f), "+");
            AddUtil(ZoomColor, null, () => Zoom(6f), "-");

            //The one thing a phone had no way to do at all: pick out a particular person.
            //Every other button here chooses its own target and always the nearest one,
            //which is right for swinging a sword and wrong for anything aimed at somebody
            //in particular.
            AddUtil(TalkColor, CreatePeopleSprite(), NearbyPeopleWindow.Toggle, null);

            //The two that change the screen rather than the character: fold the readout
            //away, and pick the skill buttons up and put them where they are wanted.
            AddUtil(ZoomColor, null, ToggleReadout, "HP");
            AddUtil(ZoomColor, null, MobileHudVisibility.ToggleHotbar, ThaiUiText.Get("Bar"));
            AddUtil(ZoomColor, null, ToggleArrange, ThaiUiText.Get("Arrange"));

            toggleButton = CreateButton(root, new Vector2(-24, 96), ToggleSize, ZoomColor, CreateMenuSprite(), ToggleControls);

            ApplyLayout();

            //nothing is shown until a character is actually in the world, and even then
            //the pad stays folded away behind the toggle until it is asked for
            controlGroup.gameObject.SetActive(false);
            toggleButton.gameObject.SetActive(false);
        }

        /// <summary>
        /// The title screen, the login box and character creation all live in the same
        /// scene as the game, so the controls key off the camera having a character to
        /// follow rather than off the scene being loaded.
        /// </summary>
        private static bool IsInGame()
        {
            var camera = CameraFollower.Instance;
            return camera != null && camera.Target != null;
        }

        private void RefreshVisibility()
        {
            var inGame = IsInGame();
            if (inGame == wasInGame)
                return;
            wasInGame = inGame;

            toggleButton.gameObject.SetActive(inGame);
            if (!inGame)
                controlGroup.gameObject.SetActive(false);
        }

        /// <summary>One more small button in the block, placed later by ApplyLayout.</summary>
        private void AddUtil(Color color, Sprite icon, UnityEngine.Events.UnityAction action, string label)
        {
            var button = CreateButton(controlGroup, Vector2.zero, UtilSize, color, icon, action, label, true);
            utilButtons.Add(button);
        }

        /// <summary>
        /// Puts everything where the shape of the screen says it goes.
        /// </summary>
        /// <remarks>
        /// Upright: three columns of small buttons stacked above the stick in the bottom
        /// left, and the two action buttons one above the other on the right, because a
        /// thumb reaching across a tall screen has more room vertically than across.
        ///
        /// Sideways: the same buttons in two columns hard against the left edge, since the
        /// screen is now shorter than that block was tall, and the action buttons side by
        /// side in the bottom right where the right thumb already rests. Sizes do not
        /// change between the two, so the labels drawn into them stay the size they were
        /// measured at.
        /// </remarks>
        private void ApplyLayout()
        {
            laidOutLandscape = MobileMode.IsLandscape;
            hasLayout = true;

            if (scaler != null)
                scaler.referenceResolution = laidOutLandscape ? LandscapeReference : PortraitReference;

            var columns = laidOutLandscape ? LandscapeUtilColumns : UtilColumns;
            var rows = Mathf.Max(1, Mathf.CeilToInt(utilButtons.Count / (float)columns));
            var originX = laidOutLandscape ? LandscapeUtilOriginX : UtilOriginX;
            var originY = laidOutLandscape ? LandscapeUtilOriginY : UtilOriginY;

            for (var i = 0; i < utilButtons.Count; i++)
            {
                var button = utilButtons[i];
                if (button == null)
                    continue;

                //row 0 is the top row of the block, so it fills upward from the stick
                var column = i % columns;
                var row = i / columns;
                button.anchoredPosition = new Vector2(
                    originX + column * (UtilSize + UtilGap),
                    originY + (rows - 1 - row) * (UtilSize + UtilGap));
            }

            if (joystickRect != null)
                joystickRect.anchoredPosition = laidOutLandscape
                    ? new Vector2(115, 116)
                    : new Vector2(130, 230);

            //Sideways they sit next to each other rather than stacked: the loot button
            //stacked above the attack button would be up where the fingers holding the
            //phone are.
            if (attackButton != null)
                attackButton.anchoredPosition = laidOutLandscape
                    ? new Vector2(-24, 108)
                    : new Vector2(-24, 170);

            if (pickUpButton != null)
                pickUpButton.anchoredPosition = laidOutLandscape
                    ? new Vector2(-148, 122)
                    : new Vector2(-34, 300);

            //clear of the menu row below it either way, which is a different height in each
            if (toggleButton != null)
                toggleButton.anchoredPosition = laidOutLandscape
                    ? new Vector2(-24, 48)
                    : new Vector2(-24, 96);

            //the menu is measured against the screen, so a turn has to make it measure again
            menuFitWidth = -1f;
        }

        private void Update()
        {
            RefreshVisibility();
            if (!wasInGame)
                return;

            //a phone can be turned over at any moment, and a browser window dragged from
            //one shape to the other without anything reloading
            if (!hasLayout || laidOutLandscape != MobileMode.IsLandscape)
                ApplyLayout();

            RestructureBottomMenu();
            UpdateJoystickWalk();
            EnsureSendButton();
        }

        /// <summary>
        /// Puts a send button on the end of the chat bar.
        ///
        /// A message is sent by the return key and by nothing else. A phone has no return
        /// key: the one on its soft keyboard closes the keyboard and produces no key event,
        /// so a message could be typed, and typed correctly, and never go anywhere.
        ///
        /// Hung on the input field itself rather than placed by hand, so it sits against the
        /// right end of the bar wherever the bar is and whatever size the screen made it.
        /// </summary>
        private void EnsureSendButton()
        {
            if (sendButton != null)
                return;

            var camera = CameraFollower.Instance;
            var field = camera != null ? camera.TextBoxInputField : null;
            if (field == null)
                return;

            var host = field.transform as RectTransform;
            if (host == null)
                return;

            var button = CreateButton(host, Vector2.zero, SendSize, TalkColor, CreateSendSprite(),
                camera.SubmitActiveTextEntry);

            //against the right end of the bar, vertically centred, rather than in a corner of
            //the screen: it belongs to the thing it sends
            button.anchorMin = new Vector2(1, 0.5f);
            button.anchorMax = new Vector2(1, 0.5f);
            button.pivot = new Vector2(1, 0.5f);
            button.anchoredPosition = new Vector2(-4f, 0f);

            //the soft keyboard's own done key does reach this on some browsers, and where it
            //does the button is only there for the ones where it does not
            field.onSubmit.AddListener(_ => camera.SubmitActiveTextEntry());

            sendButton = button;
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
                //The bar is found through its Stats button rather than its layout
                //component, since a button name is stable while the layout type is not.
                foreach (var button in FindObjectsByType<Button>(FindObjectsInactive.Include, FindObjectsSortMode.None))
                {
                    if (button.name != "Stats")
                        continue;

                    var bar = button.transform.parent;
                    if (bar == null || bar.Find("Database") == null || bar.Find("Inventory") == null)
                        continue;

                    //LayoutGroup forbids two of its kind on one object and Destroy only
                    //takes effect at the end of the frame, so the old group has to go
                    //immediately or AddComponent below quietly hands back null.
                    foreach (var old in bar.GetComponents<LayoutGroup>())
                        DestroyImmediate(old);

                    menuRect = (RectTransform)bar;
                    menuGrid = bar.gameObject.AddComponent<GridLayoutGroup>();
                    if (menuGrid == null)
                    {
                        Debug.LogWarning("[MobileControls] Could not replace the bottom menu layout.");
                        return;
                    }

                    menuGrid.spacing = new Vector2(MenuSpacing, MenuSpacing);
                    menuGrid.startCorner = GridLayoutGroup.Corner.UpperLeft;
                    menuGrid.startAxis = GridLayoutGroup.Axis.Horizontal;
                    menuGrid.childAlignment = TextAnchor.UpperCenter;
                    menuGrid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;

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

            //Sideways the whole menu fits on one line, so it is given the columns to do it
            //with; upright it wraps, and how many rows that comes to is counted rather than
            //assumed, or the bar is anchored to a height it does not have.
            var columns = laidOutLandscape ? LandscapeMenuColumns : MenuColumns;
            var cell = Mathf.Min(MenuCellWidth, (available - (columns - 1) * MenuSpacing) / columns);
            menuGrid.constraintCount = columns;
            menuGrid.cellSize = new Vector2(cell, MenuCellHeight);

            //Only the buttons that are actually shown, because the grid lays out only those
            //and a row counted for a hidden one is a gap under the bar.
            var shown = 0;
            for (var i = 0; i < menuRect.childCount; i++)
            {
                if (menuRect.GetChild(i).gameObject.activeSelf)
                    shown++;
            }

            var rows = Mathf.Max(1, Mathf.CeilToInt(shown / (float)columns));

            menuRect.anchorMin = new Vector2(1f, 0f);
            menuRect.anchorMax = new Vector2(1f, 0f);
            menuRect.pivot = new Vector2(1f, 0f);
            menuRect.sizeDelta = new Vector2(cell * columns + (columns - 1) * MenuSpacing,
                MenuCellHeight * rows + (rows - 1) * MenuSpacing);
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
        /// Opens the chat room window, which is where a room is named and sized.
        /// </summary>
        /// <remarks>
        /// This used to prefill "/chat " into the chat bar and leave the rest to the
        /// player. On a phone that means the soft keyboard over half the screen and a
        /// command whose spelling you have to already know - and no way at all to set how
        /// many people the room takes, or a password.
        /// </remarks>
        private void OpenChatRoomCommand() => Hud.ChatRoomWindow.Toggle();

        /// <summary>Folds the character readout away, or brings it back.</summary>
        private static void ToggleReadout() => MobileHudVisibility.ToggleReadout();

        /// <summary>
        /// Turns the skill buttons into things you move rather than things you press.
        /// </summary>
        /// <remarks>
        /// Says out loud what just happened, because the only visible difference is that
        /// the buttons stopped working - which without a word of explanation is a bug
        /// rather than a mode. A double tap on the same button while already arranging puts
        /// everything back where the automatic layout wanted it, which is the way out for
        /// somebody who has dragged a skill off the edge of the screen.
        /// </remarks>
        private static void ToggleArrange()
        {
            MobileSlotArranger.ToggleArrangeMode();

            var camera = CameraFollower.Instance;
            if (camera == null)
                return;

            camera.AppendChatText(MobileSlotArranger.ArrangeMode
                ? "<color=#FFD479>ลากไอคอนสกิลไปวางตรงไหนก็ได้ กดปุ่มนี้อีกครั้งเมื่อจัดเสร็จ</color>"
                : "<color=#9FE870>จัดปุ่มเสร็จแล้ว กดสกิลเพื่อใช้งานได้ตามปกติ</color>");
        }

        private void PressEscape()
        {
            if (UiManager.Instance == null)
                return;

            //matches the escape key: close the top window, or open the system menu
            //when there was nothing left to close
            if (!UiManager.Instance.CloseLastWindow())
                EscMenu.Open();
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

        //---------------------------------------------------------------- widgets

        private GameObject PlayerObject()
        {
            var camera = CameraFollower.Instance;
            return camera == null ? null : camera.Target;
        }

        private RectTransform CreateButton(RectTransform root, Vector2 offset, float size, Color color, Sprite icon,
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

            //A pale rim around the fill. The fill alone is a coloured blob that disappears
            //against anything of a similar brightness, and the map under it is every
            //brightness at once; an outline is the one thing that reads over all of them.
            var rimObject = new GameObject("Rim", typeof(Image));
            rimObject.transform.SetParent(rect, false);

            var rim = rimObject.GetComponent<Image>();
            rim.sprite = ringSprite;
            rim.color = RimColor;
            rim.raycastTarget = false;

            var rimRect = rimObject.GetComponent<RectTransform>();
            rimRect.anchorMin = Vector2.zero;
            rimRect.anchorMax = Vector2.one;
            rimRect.offsetMin = Vector2.zero;
            rimRect.offsetMax = Vector2.zero;

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
                return rect;
            }

            var font = TMP_Settings.defaultFontAsset;
            if (font == null || string.IsNullOrEmpty(label))
                return rect;

            var textObject = new GameObject("Label", typeof(TextMeshProUGUI));
            textObject.transform.SetParent(rect, false);

            var text = textObject.GetComponent<TextMeshProUGUI>();
            text.font = font;
            text.text = label;
            text.alignment = TextAlignmentOptions.Center;
            text.fontSize = size * (label.Length > 2 ? 0.3f : 0.44f);
            //white, opaque and bold: the label is two or three characters on a small circle
            //and there is no room for it to be subtle
            text.color = Color.white;
            text.fontStyle = FontStyles.Bold;
            text.raycastTarget = false;

            var textRect = textObject.GetComponent<RectTransform>();
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;

            return rect;
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
            padRect.sizeDelta = new Vector2(180, 180);
            padRect.anchoredPosition = new Vector2(130, 230);

            var knobObject = new GameObject("Knob", typeof(Image));
            knobObject.transform.SetParent(padRect, false);

            var knobImage = knobObject.GetComponent<Image>();
            knobImage.sprite = circleSprite;
            knobImage.color = new Color(1f, 1f, 1f, 0.35f);
            knobImage.raycastTarget = false;

            var knobRect = knobObject.GetComponent<RectTransform>();
            knobRect.anchorMin = new Vector2(0.5f, 0.5f);
            knobRect.anchorMax = new Vector2(0.5f, 0.5f);
            knobRect.sizeDelta = new Vector2(76, 76);

            joystick = padObject.GetComponent<JoystickPad>();
            joystick.Knob = knobRect;
            joystick.Radius = 58f;
            joystickRect = padRect;
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

        /// <summary>
        /// A ring: the outline of the circle above, a few pixels thick and soft on both
        /// sides so it does not come out as a staircase at the size it is drawn.
        /// </summary>
        private static Sprite CreateRingSprite()
        {
            var pixels = NewTransparentBuffer();
            var center = (IconResolution - 1) * 0.5f;
            var radius = center - 1.5f;
            var thickness = IconResolution * 0.055f;

            for (var y = 0; y < IconResolution; y++)
            {
                for (var x = 0; x < IconResolution; x++)
                {
                    var distance = Vector2.Distance(new Vector2(x, y), new Vector2(center, center));
                    var alpha = Mathf.Clamp01(thickness - Mathf.Abs(distance - radius + thickness * 0.5f));
                    pixels[y * IconResolution + x] = new Color(1, 1, 1, alpha);
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

        /// <summary>
        /// Two heads side by side, for the list of people nearby.
        ///
        /// A picture rather than the word, which in Thai is nine characters and folded onto
        /// a second line inside a button 62 across. The other labels here got away with text
        /// by being two or three characters wide.
        /// </summary>
        private static Sprite CreatePeopleSprite()
        {
            var pixels = NewTransparentBuffer();

            FillRect(pixels, 12, 36, 26, 50, Color.white); //head, behind and left
            FillRect(pixels, 8, 12, 30, 33, Color.white);  //shoulders

            FillRect(pixels, 34, 40, 50, 56, Color.white); //head, in front and right
            FillRect(pixels, 30, 12, 54, 37, Color.white); //shoulders

            return BuildSprite(pixels);
        }

        /// <summary>An arrow pointing right, for the button that sends what was typed.</summary>
        private static Sprite CreateSendSprite()
        {
            var pixels = NewTransparentBuffer();

            FillRect(pixels, 12, 29, 44, 35, Color.white); //shaft

            //a head drawn as a stack of shortening bars, which is a triangle at this size
            for (var i = 0; i < 12; i++)
                FillRect(pixels, 34 + i, 32 - (12 - i), 36 + i, 32 + (12 - i), Color.white);

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
