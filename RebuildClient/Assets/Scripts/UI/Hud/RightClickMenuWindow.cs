using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    public class RightClickMenuWindow : WindowBase
    {
        public GameObject EntryPrefab;
        public GameObject BoundaryPrefab;

        private Transform container;
        private Stack<Button> unusedButtons;
        private Stack<GameObject> unusedBoundaries;
        private List<Button> activeButtons;
        private List<GameObject> activeBoundaries;

        private int targetEntityId;
        private int partyMemberId;

        //Kept beside the entity id because the friend list and the private message both work
        //by name: one has to reach somebody who is not on screen, and the other has to reach
        //somebody who may not be online at all.
        private string targetName;

        public bool RightClickSelf()
        {
            unusedButtons ??= new Stack<Button>();
            unusedBoundaries ??= new Stack<GameObject>();
            activeButtons ??= new List<Button>();
            activeBoundaries ??= new List<GameObject>();
            
            if(gameObject.activeInHierarchy)
                HideWindow();
            
            var state = PlayerState.Instance;
            if (!state.IsInParty)
                return false;

            var button = AddEntry($"Leave party");
            button.onClick.AddListener(LeaveParty);
            
            transform.position = UiManager.Instance.GetScreenPositionOfCursor();
            
            ShowWindow();
            CameraFollower.Instance.ActivePromptType = PromptType.RightClickMenu;

            return true;
        }
        
        public bool RightClickPartyMenu(PointerEventData pointerEvent)
        {
            unusedButtons ??= new Stack<Button>();
            unusedBoundaries ??= new Stack<GameObject>();
            activeButtons ??= new List<Button>();
            activeBoundaries ??= new List<GameObject>();
            
            if(gameObject.activeInHierarchy)
                HideWindow();
            
            var state = PlayerState.Instance;
            if (!state.IsInParty || state.PartyLeader != state.PartyMemberId)
                return false;

            var partyPanelEntry = pointerEvent.pointerEnter.GetComponent<PartyPanelEntry>();
            if (partyPanelEntry == null)
                return false;

            var info = partyPanelEntry.PartyMemberInfo;

            if (info.Controllable != null)
            {
                RightClickPlayer(info.Controllable);
                return true;
            }

            partyMemberId = info.PartyMemberId;
            //
            // var button = AddEntry($"Promote {info.PlayerName} to party leader");
            // button.onClick.AddListener(PromoteToLeader);
                        
            var button2 = AddEntry($"Kick {info.PlayerName} from the party");
            button2.onClick.AddListener(KickFromParty);

            transform.position = UiManager.Instance.GetScreenPositionOfCursor();
            
            ShowWindow();
            CameraFollower.Instance.ActivePromptType = PromptType.RightClickMenu;

            return true;
        }

        public void RightClickPlayer(ServerControllable target)
        {
            unusedButtons ??= new Stack<Button>();
            unusedBoundaries ??= new Stack<GameObject>();
            activeButtons ??= new List<Button>();
            activeBoundaries ??= new List<GameObject>();
            
            if(gameObject.activeInHierarchy)
                HideWindow();

            targetEntityId = target.Id;
            
            var state = PlayerState.Instance;
            if (state.EntityId == target.Id || target.CharacterType == CharacterType.PlayerLikeNpc)
                return;

            //Remembering somebody and saying something to them come first, because neither
            //depends on range, on a party, or on who leads one - they are the two things
            //this menu can always offer, and a menu whose first entry is sometimes there
            //and sometimes not is one nobody builds muscle memory for.
            targetName = target.Name;
            if (!PlayerState.Instance.IsFriend(target.Name))
            {
                var friendButton = AddEntry($"จดจำ {target.Name} เป็นเพื่อน");
                friendButton.onClick.AddListener(RememberFriend);
            }

            var whisperButton = AddEntry($"คุยกับ {target.Name}");
            whisperButton.onClick.AddListener(WhisperTo);

            //Trading is offered before the party entries because it is the one that does not
            //depend on who leads what: anybody standing close enough can ask anybody else.
            //Out of range it is left off rather than greyed, so a menu entry never appears
            //that could only produce a refusal.
            if (Distance(target) <= TradeRange)
            {
                var tradeButton = AddEntry($"Trade with {target.Name}");
                tradeButton.onClick.AddListener(TradeWith);
            }

            if (state.IsInParty)
            {
                if (state.PartyLeader == state.PartyMemberId)
                {
                    if (target.PartyName == state.PartyName)
                    {
                        if (!state.PartyMemberIdLookup.TryGetValue(targetEntityId, out partyMemberId))
                            return;
                        
                        var button = AddEntry($"Promote {target.Name} to party leader");
                        button.onClick.AddListener(PromoteToLeader);
                        
                        var button2 = AddEntry($"Kick {target.Name} from the party");
                        button2.onClick.AddListener(KickFromParty);
                    }
                    else if (string.IsNullOrWhiteSpace(target.PartyName))
                    {
                        var button = AddEntry($"Invite {target.Name} to party");
                        button.onClick.AddListener(InviteToParty);
                    }
                }
            }
            else
            {
                if (string.IsNullOrWhiteSpace(target.PartyName))
                {
                    var button = AddEntry($"Form a party with {target.Name}");
                    button.onClick.AddListener(FormPartyWith);
                }
            }

            if (activeButtons.Count <= 0)
                return;

            transform.position = UiManager.Instance.GetScreenPositionOfCursor();

            //StartCoroutine(DelayedRebuild());
            ShowWindow();
            CameraFollower.Instance.ActivePromptType = PromptType.RightClickMenu;
        }

        public void LeaveParty()
        {
            if(!PlayerState.Instance.IsInParty)
                CameraFollower.Instance.AppendChatText($"<color=yellow>คุณยังไม่ได้อยู่ปาร์ตี้</color>");
            else
                NetworkManager.Instance.LeaveParty();
            HideWindow();
        }

        /// <summary>The server's own trade range, so the menu agrees with what it will allow.</summary>
        private const int TradeRange = 12;

        private static int Distance(ServerControllable target)
        {
            var me = CameraFollower.Instance != null ? CameraFollower.Instance.PlayerPosition : Vector2Int.zero;
            var d = target.CellPosition - me;
            return Mathf.RoundToInt(Mathf.Sqrt(d.x * d.x + d.y * d.y));
        }

        public void RememberFriend()
        {
            NetworkManager.Instance.SendFriendAdd(targetName);
            HideWindow();
        }

        public void WhisperTo()
        {
            Party.WhisperWindow.Open(targetName);
            HideWindow();
        }

        public void TradeWith()
        {
            NetworkManager.Instance.SendTradeAction(TradeAction.Request, targetEntityId);
            HideWindow();
        }

        public void InviteToParty()
        {
            NetworkManager.Instance.PartyInviteById(targetEntityId);
            HideWindow();
        }

        public void KickFromParty()
        {
            if (!PlayerState.Instance.PartyMembers.TryGetValue(partyMemberId, out var info))
                return;
            UiManager.Instance.YesNoOptionsWindow.BeginPrompt($"เตะ {info.PlayerName} ออกจากปาร์ตี้?", "ตกลง", "ยกเลิก",
                () => NetworkManager.Instance.PartyUpdateAction(partyMemberId, PartyClientAction.RemovePlayer), null, false, true,
                "ปาร์ตี้", ModernUiIcons.Person);
        }

        public void PromoteToLeader()
        {
            if (!PlayerState.Instance.PartyMembers.TryGetValue(partyMemberId, out var info))
                return;
            UiManager.Instance.YesNoOptionsWindow.BeginPrompt($"ยก {info.PlayerName} ขึ้นเป็นหัวหน้าปาร์ตี้?", "ตกลง", "ยกเลิก",
                () => NetworkManager.Instance.PartyUpdateAction(partyMemberId, PartyClientAction.ChangeLeader), null, false, true,
                "ปาร์ตี้", ModernUiIcons.Person);
        }

        public void FormPartyWith()
        {
            var state = PlayerState.Instance;
            if (!state.KnownSkills.TryGetValue(CharacterSkill.BasicMastery, out var mastery) || mastery < 6)
            {
                CameraFollower.Instance.AppendError($"ต้องมี Basic Skill เลเวล 6 ขึ้นไป ถึงจะตั้งปาร์ตี้ได้");
                return;
            }
            
            UiManager.Instance.TextInputWindow.BeginTextInput("ตั้งชื่อปาร์ตี้ (ห้ามซ้ำกับคนอื่น)", FinishCreateParty,
                "ตั้งปาร์ตี้", ModernUiIcons.Person);
        }

        public void FinishCreateParty(string partyName)
        {
            NetworkManager.Instance.OrganizeParty(partyName, targetEntityId);
            HideWindow();
        }
        
        public override void HideWindow()
        {
            if (activeButtons != null)
            {
                foreach (var b in activeButtons)
                {
                    b.gameObject.SetActive(false);
                    b.onClick.RemoveAllListeners();
                    unusedButtons.Push(b);
                }
                activeButtons.Clear();
            }

            if (activeBoundaries != null)
            {
                foreach (var g in activeBoundaries)
                {
                    g.SetActive(false);
                    unusedBoundaries.Push(g);
                }
                activeBoundaries.Clear();
            }

            if (CameraFollower.Instance.ActivePromptType == PromptType.RightClickMenu)
                CameraFollower.Instance.ActivePromptType = PromptType.None;
            base.HideWindow();
        }

        public Button AddEntry(string entryText)
        {
            if (!unusedButtons.TryPop(out var button))
            {
                var go = GameObject.Instantiate(EntryPrefab, transform);
                button = go.GetComponent<Button>();
            }

            var text = button.transform.GetChild(0).GetComponent<TextMeshProUGUI>();
            text.text = entryText;
            
            if (activeButtons.Count > 0)
            {
                if (!unusedBoundaries.TryPop(out var boundary))
                    boundary = Instantiate(BoundaryPrefab, transform);
                boundary.SetActive(true);
                boundary.transform.SetAsLastSibling();
                activeBoundaries.Add(boundary);
            }
            
            button.gameObject.transform.SetAsLastSibling();
            button.gameObject.SetActive(true);
            
            activeButtons.Add(button);

            return button;
        }

        public void Awake()
        {
            EntryPrefab.SetActive(false);
            BoundaryPrefab.SetActive(false);
            container = transform.parent;
        }
        
        public void Update()
        {
            if (transform != container.GetChild(container.childCount - 1))
                HideWindow();
        }
    }
}