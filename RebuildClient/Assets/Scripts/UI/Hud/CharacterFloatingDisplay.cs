using Assets.Scripts.Network;
using Assets.Scripts.Objects;
using Assets.Scripts.UI.ConfigWindow;
using Assets.Scripts.UI.Guild;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    public class CharacterFloatingDisplay : MonoBehaviour
    {
        private ServerControllable controllable;
        private TextMeshProUGUI namePlate;
        private SliderBar castBar;
        private SliderBar hpBar;
        private SliderBar mpBar;
        private CharacterChat chatBubble;

        public CharacterOverlayManager Manager;
        public float StandingHeight;

        private string characterName;
        private int maxHp;
        private int maxMp;
        private bool isPlayer;
        private bool isMain;

        private float castStart;
        private float castEnd;
        private float chatEnd;

        private bool isHovering;
        private bool isTargeting;

        private Image emblem;

        /// <summary>How big the mark is drawn against the name beside it.</summary>
        private const float EmblemScale = 1.15f;
        private const float EmblemGap = 2f;

        public void Close()
        {
            if (Manager == null)
                return;
            Manager.ReturnFloatingDisplay(this);
        }

        public void ReturnToPool()
        {
            if (Manager == null)
            {
                Destroy(gameObject); //it's all fucked
                return;
            }

            //Same reason HideNamePlate destroys it: the mark is a child of the plate and
            //the plate goes back to a pool shared with every monster on the map. Missed
            //here, and the next character handed this plate wears the last one's guild.
            if (emblem != null)
            {
                Destroy(emblem.gameObject);
                emblem = null;
            }

            if (namePlate != null) Manager.ReturnNamePlate(namePlate.gameObject);
            if (castBar != null) Manager.ReturnCastBar(castBar.gameObject);
            if (hpBar != null) Manager.ReturnHpBar(hpBar.gameObject);
            if (mpBar != null) Manager.ReturnMpBar(mpBar.gameObject);
            if (chatBubble != null) Manager.ReturnChatBubble(chatBubble.gameObject);

            namePlate = null;
            castBar = null;
            hpBar = null;
            mpBar = null;
            chatBubble = null;
            controllable = null;
            StandingHeight = 0;
        }

        public void SetUp(ServerControllable controllable, string name, int maxHp, int maxMp, bool isPlayer, bool isMain)
        {
            characterName = name;
            this.controllable = controllable;
            this.maxHp = maxHp;
            this.maxMp = maxMp;
            this.isPlayer = isPlayer;
            this.isMain = isMain;
            gameObject.SetActive(false);
        }

        public void UpdateName(string newName)
        {
            characterName = newName;

            //the name is set again whenever anything on the plate changes, which is also
            //every moment the emblem could have changed underneath it
            if (namePlate != null)
            {
                namePlate.text = characterName;
                RefreshEmblem();
            }
        }

        public void HoverNamePlate()
        {
            ShowNamePlate();
            isHovering = true;
        }

        public void TargetingNamePlate()
        {
            ShowNamePlate();
            isTargeting = true;
        }

        public void EndHoverNamePlate()
        {
            isHovering = false;
            if (isTargeting)
                return; //we still need this plate to show
            HideNamePlate();
        }

        public void EndTargetingNamePlate()
        {
            isTargeting = false;
            if (isHovering)
                return; //we still need this plate to show
            HideNamePlate();
        }

        private void ShowNamePlate()
        {
            if (namePlate != null)
                return;
            namePlate = Manager.AttachNamePlate(gameObject);
            namePlate.text = characterName;
            RefreshEmblem();
            gameObject.SetActive(true);
        }

        private void HideNamePlate()
        {
            if (namePlate == null)
                return;

            //the emblem is a child of the plate, so it goes back to the pool wearing it -
            //cleared here rather than left for whoever the plate is handed to next
            if (emblem != null)
            {
                Destroy(emblem.gameObject);
                emblem = null;
            }

            Manager.ReturnNamePlate(namePlate.gameObject);
            namePlate = null;
        }

        /// <summary>
        /// Puts the guild's mark in front of the name, or takes it away again.
        ///
        /// Placed against the width of the first line rather than against the plate's rect:
        /// the plate is as wide as its widest line, which is usually the guild line, and
        /// anchoring to its edge would leave the mark floating out in front of nothing.
        ///
        /// Built here rather than in the prefab because the plate comes from a pool shared
        /// by every character on screen, most of whom are in no guild - a mark on the prefab
        /// would be thirty objects switched off for every one switched on.
        /// </summary>
        private void RefreshEmblem()
        {
            //A plate can arrive from the pool already wearing somebody else's mark, so
            //whatever is on it is adopted before anything is decided. Without this the
            //check below reads a null field, concludes there is nothing to hide, and
            //leaves a stray emblem sitting in front of a monster's name - which is how
            //every poring in the field came to be flying a guild's colours.
            if (emblem == null && namePlate != null)
            {
                var stray = namePlate.transform.Find("GuildEmblem");
                if (stray != null)
                    emblem = stray.GetComponent<Image>();
            }

            var id = controllable != null ? controllable.GuildEmblem : 0;

            if (namePlate == null || id <= 0)
            {
                if (emblem != null)
                    emblem.gameObject.SetActive(false);
                return;
            }

            if (emblem == null)
            {
                var go = new GameObject("GuildEmblem", typeof(Image));
                go.transform.SetParent(namePlate.transform, false);
                emblem = go.GetComponent<Image>();
                emblem.raycastTarget = false;
                emblem.preserveAspect = true;
            }

            emblem.gameObject.SetActive(true);
            GuildEmblems.LoadInto(emblem, id);

            var firstLine = characterName;
            var breakAt = firstLine.IndexOf('\n');
            if (breakAt > 0)
                firstLine = firstLine.Substring(0, breakAt);

            var width = namePlate.GetPreferredValues(firstLine).x;
            var size = namePlate.fontSize * EmblemScale;

            var rect = emblem.rectTransform;
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(0.5f, 1f);
            rect.sizeDelta = new Vector2(size, size);
            //half the line to reach its left edge, then the mark's own width and a gap
            rect.anchoredPosition = new Vector2(-(width * 0.5f + size * 0.5f + EmblemGap),
                -namePlate.fontSize * 0.5f + size * 0.5f);
        }

        public void StartCasting(float castTime)
        {
            if (castBar == null)
                castBar = Manager.AttachCastBar(gameObject);

            if (controllable.SpriteAnimator?.SpriteData != null)
            {
                StandingHeight = controllable.SpriteAnimator.SpriteData.StandingHeight;
                StandingHeight = StandingHeight * 1.5f * (1 / GameConfig.Data.MasterUIScale) + 15;
                if (StandingHeight < 40)
                    StandingHeight = 40;
                if (controllable.CharacterType == CharacterType.Player)
                    StandingHeight += 28;
            }
            
            castBar.transform.localPosition = new Vector3(0, StandingHeight, 0);
            castBar.SetProgress(0);
            castStart = Time.timeSinceLevelLoad;
            castEnd = castStart + castTime;
            castBar.gameObject.SetActive(true);
            gameObject.SetActive(true);
        }

        public void CancelCasting()
        {
            if (castBar != null)
            {
                Manager.ReturnCastBar(castBar.gameObject);
                castBar = null;
            }

            //this is the biggest hack I've ever seen. End the chat bubble if it's showing monster cast name
            if (chatBubble != null && chatBubble.TextObject.text.Contains("<color=#FF8888>"))
            {
                Manager.ReturnChatBubble(chatBubble.gameObject);
                chatBubble = null;
            }
            
            //controllable.StopCastingAnimation();
        }

        public void ExtendCasting(float addTime)
        {
            if (castBar == null)
                return;

            var len = castEnd - castStart;
            var pos = Time.timeSinceLevelLoad - castStart;
            var remain = len - pos;
            var passed = len - remain;

            var addPercent = (remain + addTime) / remain;
            var subStart = (passed * addPercent) - passed;

            castStart -= subStart;
            castEnd += addTime;

            //castBar.SetProgress(pos / end);
        }

        public void HideChatBubbleMessage()
        {
            if (chatBubble == null)
                return;

            Manager.ReturnChatBubble(chatBubble.gameObject);
            chatBubble = null;
        }

        public void ShowChatBubbleMessage(string message, float visibleTime = 5f)
        {
            if (chatBubble == null)
                chatBubble = Manager.AttachChatBubble(gameObject);

            if (controllable.SpriteAnimator?.SpriteData != null)
            {
                StandingHeight = controllable.SpriteAnimator.SpriteData.StandingHeight;
                StandingHeight = StandingHeight * 1.5f * (1 / GameConfig.Data.MasterUIScale) + 15;
                if (StandingHeight < 40)
                    StandingHeight = 40;
                if (controllable.CharacterType == CharacterType.Player)
                    StandingHeight += 28;
            }

            chatBubble.transform.localPosition = new Vector3(0, StandingHeight + 13, 0);

            chatBubble.SetText(message);
            chatEnd = Time.timeSinceLevelLoad + visibleTime;
            gameObject.SetActive(true);
        }

        public void HideMpBar()
        {
            if (mpBar == null)
                return;
            
            Manager.ReturnMpBar(mpBar.gameObject);
            mpBar = null;
        }

        public void ForceMpBarOn()
        {
            if (mpBar != null)
                return;

            mpBar = Manager.AttachMpBar(gameObject);
            gameObject.SetActive(true);
        }

        public void UpdateMaxMp(int maxMp) => this.maxMp = maxMp;

        public void UpdateMp(int mp)
        {
            if (mpBar == null)
                ForceMpBarOn();
            
            mpBar.SetProgress((float)mp / maxMp);
            
            if(isPlayer)
                ((RectTransform)mpBar.transform).sizeDelta = new Vector2(100f, 10f);
            else
                ((RectTransform)mpBar.transform).sizeDelta = new Vector2(90f, 10f); //when would this ever happen...?
        }
        
        public void HideHpBar()
        {
            if (hpBar == null)
                return;
            Manager.ReturnHpBar(hpBar.gameObject);
            hpBar = null;
        }

        public void ForceHpBarOn()
        {
            if (hpBar != null)
                return;
            // if(GameConfig.Data.AutoHideFullHPBars)

            hpBar = Manager.AttachHpBar(gameObject);
            gameObject.SetActive(true);
            UpdateMaxHp(controllable.MaxHp);
            UpdateHp(controllable.Hp, controllable.Hp, false);
            RefreshHpBarDetails();
        }

        public void UpdateMaxHp(int maxHp) => this.maxHp = maxHp;

        public void UpdateHp(int oldHp, int hp, bool animate = true)
        {
            if (hpBar == null)
            {
                if ((hp == maxHp && oldHp == hp) || (!isPlayer && !GameConfig.Data.ShowMonsterHpBars))
                    return;
                hpBar = Manager.AttachHpBar(gameObject);
                gameObject.SetActive(true);
                hpBar.SetProgress((float)oldHp / maxHp);
            }

            if (oldHp >= 0)
            {
                hpBar.SetProgress((float)hp / maxHp, !animate);
            }
            else
                hpBar.SetProgress((float)hp / maxHp);
                
            // Debug.Log($"Update HP on {characterName}: {hp}/{maxHp}");
            gameObject.SetActive(true);
            RefreshHpBarDetails();
        }

        public void RefreshHpBarDetails()
        {
            if (hpBar == null)
                return;
            
            if (isPlayer)
            {
                if(controllable.IsPartyMember || controllable.IsMainCharacter)
                    hpBar.SetColor(new Color32(0x6C, 0xEA, 0x45, 255));
                else //EAE745
                    hpBar.SetColor(new Color32(0xEA, 0xEA, 0x35, 255));
                if(isMain)
                    ((RectTransform)hpBar.transform).sizeDelta = new Vector2(100f, 10f);
                else
                    ((RectTransform)hpBar.transform).sizeDelta = new Vector2(100f, 10f);
            }
            else
            {
                if (GameConfig.Data.ShowMonsterHpBars)
                {
                    hpBar.SetColor(new Color32(0xC8, 0x45, 0xEA, 255));
                    ((RectTransform)hpBar.transform).sizeDelta = new Vector2(90f, 10f);
                }
                else
                {
                    Manager.ReturnHpBar(hpBar.gameObject);
                }
            }
        }

        public void Update()
        {
            if (chatBubble != null)
            {
                if (Time.timeSinceLevelLoad > chatEnd)
                {
                    Manager.ReturnChatBubble(chatBubble.gameObject);
                    chatBubble = null;
                } 
                else
                    chatBubble.RefreshBorder();
            }

            if (castBar != null)
            {
                if (Time.timeSinceLevelLoad > castEnd)
                    CancelCasting();
                else
                {
                    var pos = Time.timeSinceLevelLoad - castStart;
                    var end = castEnd - castStart;
                    castBar.SetProgress(pos / end);
                }
            }
        }
    }
}