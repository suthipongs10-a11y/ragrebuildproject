using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.UI.ConfigWindow;
using Assets.Scripts.UI.Utility;
using TMPro;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Inventory
{
    public class VendingActiveWindow : WindowBase
    {
        public TextMeshProUGUI ShopName;
        public ItemIconContainer IconContainer;

        public void StopVending()
        {
            Destroy(gameObject);
            NetworkManager.Instance.VendingEnd();
            CameraFollower.Instance.AppendChatText("ปิดร้านแล้ว", TextColor.Job);
        }

        /// <summary>
        /// Logs out and leaves the shop selling.
        /// </summary>
        /// <remarks>
        /// The packet goes first and the socket closes after it, which is the order the
        /// server needs: it reads the request off the wire and writes down what was meant
        /// before the connection ending ever reaches the code that decides whether the
        /// character leaves the world with it.
        ///
        /// Everything after that line is what the escape menu's own logout does, and for
        /// the same reasons - the settings are written out, the socket is closed politely
        /// so the server is not left waiting on a timeout, and the title scene is loaded.
        /// </remarks>
        private void GoOffline()
        {
            NetworkManager.Instance.VendingGoOffline();

            GameConfig.SaveConfig();
            NetworkManager.Instance.Disconnect();
            SceneManager.LoadScene(0);
        }

        private void AskToGoOffline()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.YesNoOptionsWindow == null)
            {
                //No prompt to ask with is not a reason to log somebody out without asking.
                Debug.LogError("[VendingActiveWindow] No confirmation window, so nothing was done.");
                return;
            }

            ui.YesNoOptionsWindow.BeginPrompt(
                "ออกจากเกมโดยให้ร้านเปิดขายต่อไหม? ของที่ขายได้จะเข้ากระเป๋าเมื่อกลับมา",
                "ตั้งร้าน Offline", "ยกเลิก", GoOffline, null, false, true,
                "ตั้งร้านค้า Offline", ModernUiIcons.Bag);
        }

        /// <summary>
        /// Puts the offline button on the row the close button is already on.
        /// </summary>
        /// <remarks>
        /// Measured off that button rather than placed by number. The row hangs under the
        /// frame rather than inside it, on a pivot that is not the one anything else here
        /// uses, and copying the rect that is already sitting where it should be is the
        /// only way to land beside it without knowing any of that. If the prefab ever
        /// stops having that button, the shop still opens - it just opens without this.
        /// </remarks>
        private void AddOfflineButton()
        {
            var close = transform.Find("InteractButtons/Cancel") as RectTransform;
            if (close == null)
            {
                Debug.LogWarning("[VendingActiveWindow] Could not find the close button, "
                                 + "so the shop opens without an offline button.");
                return;
            }

            const float width = 160f;
            const float gap = 6f;

            var button = ModernUiTheme.CreateButton(close.parent, "GoOffline", "ตั้งร้านค้า Offline",
                ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor, ModernUiTheme.SizeSmall);

            var rect = (RectTransform)button.transform;
            rect.anchorMin = close.anchorMin;
            rect.anchorMax = close.anchorMax;
            rect.pivot = close.pivot;
            rect.sizeDelta = new Vector2(width, close.sizeDelta.y);
            rect.anchoredPosition = close.anchoredPosition - new Vector2(width + gap, 0f);

            button.onClick.AddListener(AskToGoOffline);
        }

        private Dictionary<int, InventoryItem> itemList;
        public Dictionary<int, int> ItemPriceList; //public because it's used by DraggableItem to show selling price in mouseover overlay

        public static VendingActiveWindow Instance;


        public static void BeginActiveVending(string shopName, Dictionary<int, InventoryItem> list, Dictionary<int, int> prices)
        {
            var go = Instantiate(Resources.Load<GameObject>("ActiveVend"), UiManager.Instance.PrimaryUserWindowContainer);
            var window = go.GetComponent<VendingActiveWindow>();
            var co = window.IconContainer;

            window.ShopName.text = $"Vending: {shopName}";
            co.AssignItemList(list, DragItemType.VendActive);

            window.ItemPriceList = prices;
            window.itemList = list;

            window.AddOfflineButton();

            window.CenterWindow();
            window.MoveToTop();

            Instance = window;
        }

        public void ReceiveNotificationOfSale(int bagId, int count)
        {
            if (!itemList.TryGetValue(bagId, out var saleItem))
                return;

            var price = ItemPriceList[bagId];

            var zeny = price * count;
            if(count == 1)
                CameraFollower.Instance.AppendChatText($"ขาย {saleItem.ProperName()} ได้ {zeny:N0}z");
            else
                CameraFollower.Instance.AppendChatText($"ขาย {saleItem.ProperName()} x{count} ได้ {zeny:N0}z");

            saleItem.Count -= count;
            if (saleItem.Count <= 0)
            {
                itemList.Remove(bagId);
                ItemPriceList.Remove(bagId);
            }
            else
                itemList[bagId] = saleItem;
            
            PlayerState.Instance.Zeny += zeny;
            
            CameraFollower.Instance.CharacterDetailBox.CharacterZeny.text = $"Zeny: {PlayerState.Instance.Zeny:N0}";
            
            IconContainer.RefreshItemList();
        }
    }
}