using System;
using Assets.Scripts.Network;
using TMPro;
using UnityEngine;

namespace Assets.Scripts.UI.Hud
{
    public class PartyInviteToast : MonoBehaviour
    {
        public TextMeshProUGUI PrimaryCaption;
        public TextMeshProUGUI SecondaryCaption;
        public GameObject ToastBox;
        
        [NonSerialized] public ToastNotificationArea Parent;
        [NonSerialized] public int PartyId;
        [NonSerialized] public string LeaderName;
        [NonSerialized] public string PartyName;
        
        public void OnClick()
        {
            var promptWindow = UiManager.Instance.YesNoOptionsWindow;
            
            promptWindow.BeginPrompt($"<color=#1B6E3C>{LeaderName}</color> ชวนคุณเข้าปาร์ตี้ '<color=#2A56A8>{PartyName}</color>'\nเข้าร่วมไหม",
                "เข้าร่วม", "ปฏิเสธ", AcceptPartyInvite, DeclinePartyInvite, false, true,
                "คำเชิญเข้าปาร์ตี้", ModernUiIcons.Person);
        }

        private void AcceptPartyInvite()
        {
            NetworkManager.Instance.PartyAcceptInvite(PartyId);
            OnDismiss();
        }

        private void DeclinePartyInvite()
        {
            OnDismiss();
        }

        public void OnDismiss()
        {
            Parent.OnCloseNotification(LeaderName);
            Destroy(gameObject);
        }
    }
}