using System;
using Assets.Scripts.Network;
using Assets.Scripts.Sprites;
using Assets.Scripts.UI.Guild;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    public class StatusEffectEntry : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IPointerClickHandler
    {
        public Image StatusIcon;
        public TextMeshProUGUI RemainingTime;
        
        [NonSerialized] public CharacterStatusEffect StatusEffect;
        [NonSerialized] public float Expiration;
        [NonSerialized] public bool CanCancel;
        [NonSerialized] public bool IsPartyMember;
        [NonSerialized] public bool IsBuff;

        private int secondsRemaining;

        public bool IsExpired => Expiration - Time.timeSinceLevelLoad < 0f;

        public void UpdateTime()
        {
            var timeRemaining = Expiration - Time.timeSinceLevelLoad;
            var seconds = (int)(timeRemaining + 1f);
            if (seconds <= 0 || seconds > 86400) //stop showing if the timer is greater than 24h
            {
                RemainingTime.text = "";
                RemainingTime.gameObject.SetActive(false);
                return;
            }

            if (secondsRemaining == seconds)
                return;

            RemainingTime.gameObject.SetActive(true);
            secondsRemaining = seconds;

            if (seconds <= 60)
                RemainingTime.text = $"{seconds}s";
            else if (seconds <= 3600)
                RemainingTime.text = $"{seconds / 60}m";
            else
                RemainingTime.text = $"{seconds / 3600}h";
        }

        public void OnPointerEnter(PointerEventData eventData)
        {
            if (UiManager.Instance.IsDraggingItem)
                return;

            if (IsPartyMember && !Input.GetKey(KeyCode.LeftShift) && !Input.GetKey(KeyCode.RightShift))
                return;

            var data = ClientDataLoader.Instance.GetStatusEffect((int)StatusEffect);
            var desc = data != null ? data.Description : "";

            //The guild buff is the one status whose worth is not fixed by the effect itself
            //but by what the guild has bought, so the description on its own says only that
            //something is helping. The levels are read at the moment of hovering, which is
            //what makes a skill raised a minute ago show up without relogging.
            if (StatusEffect == CharacterStatusEffect.GuildBuff)
            {
                var summary = GuildSkillText.BuffSummary();
                if (!string.IsNullOrEmpty(summary))
                    desc = string.IsNullOrEmpty(desc) ? summary : desc + "\n\n" + summary;
            }

            if (!string.IsNullOrEmpty(desc))
            {
                if (CanCancel)
                    desc += "\n<size=-6>(Shift-Right Click to Remove)";
                UiManager.Instance.ShowTooltip(gameObject, desc);
                return;
            }
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            UiManager.Instance.HideTooltip(gameObject);
        }

        public void OnDestroy()
        {
            UiManager.Instance.HideTooltip(gameObject); //will do nothing if this isn't the actively hovered object
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if(eventData.button == PointerEventData.InputButton.Right && (Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift)))
            {
                var status = ClientDataLoader.Instance.GetStatusEffect((int)StatusEffect);
                if(status.CanDisable && CanCancel)
                    NetworkManager.Instance.SendRemoveStatusEffect(StatusEffect);
            }
        }
    }
}