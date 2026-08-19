using System;
using Assets.Scripts.Network;
using Assets.Scripts.UI.ConfigWindow;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Assets.Scripts.UI.Hud
{
    public class VendTitleBox : MonoBehaviour, IPointerClickHandler, IPointerEnterHandler, IPointerExitHandler
    {
        public int VendOwnerId;
        [NonSerialized] public bool IsChatRoom;
        [NonSerialized] public GameObject FollowObject;
        
        public RectTransform Parent;
        public RectTransform Self;
        public TextMeshProUGUI Text;

        private float height = 0;
        
        public void SnapDialog()
        {
            var cf = CameraFollower.Instance;
            var rect = Self;
            var screenPos = cf.Camera.WorldToScreenPoint(FollowObject.transform.position);

            var d = 70 / cf.Distance;
            var reverseScale = 1f / cf.CanvasScaler.scaleFactor;

            if (!GameConfig.Data.ScalePlayerDisplayWithZoom)
                d = 1f;
            var screenScale = Screen.height / 1920f * 2f;
            d *= screenScale;
            
            rect.localScale = new Vector3(d, d, d);
            rect.anchoredPosition = new Vector2(screenPos.x * reverseScale, (screenPos.y - cf.UiCanvas.pixelRect.height) * reverseScale);
        }

        public void Update()
        {
            if(FollowObject != null)
                SnapDialog();
        }

        //A sign is a thing you click, so the cursor says so while it is over one. Released
        //on disable as well as on exit: a shop closing under a resting pointer sends no
        //exit event, and the cursor would be left as a hand over open ground.
        public void OnPointerEnter(PointerEventData eventData) =>
            UiCursorOverride.Claim(this, GameCursorMode.Interact);

        public void OnPointerExit(PointerEventData eventData) => UiCursorOverride.Release(this);

        public void OnDisable() => UiCursorOverride.Release(this);

        public void OnDestroy() => UiCursorOverride.Release(this);

        public void OnPointerClick(PointerEventData eventData)
        {
            if (eventData.button != PointerEventData.InputButton.Left)
                return;

            //One click, the same as a chat room, and for the same reason: a phone has no
            //double click, and the sign is a small label that drifts with the player it
            //belongs to - asking for two hits on it is asking for none. Opening a shop only
            //shows what is for sale, so a click landing by accident costs nothing.
            if (IsChatRoom)
                NetworkManager.Instance.SendNpcClick(VendOwnerId);
            else
                NetworkManager.Instance.VendingOpenStore(VendOwnerId);
        }
    }
}