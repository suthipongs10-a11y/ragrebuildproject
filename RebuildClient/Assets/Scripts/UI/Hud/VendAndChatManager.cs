using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    public class VendAndChatManager : MonoBehaviour
    {
        /// <summary>
        /// What the server puts on the front of a locked room's title, and the only thing
        /// that says a room has a password: the sign's text is all the client is given
        /// about a room it has not joined. Stripped here so it is never drawn, and kept in
        /// step with ChatRoomNpcProxy.LockedMarker on the server.
        /// </summary>
        private const char LockedMarker = '\u0001';

        /// <summary>What a locked room says instead of the marker it arrived with.</summary>
        private const string LockedSuffix = "  (รหัส)";

        /// <summary>
        /// A chat room's sign: white, outlined in deep blue, with somebody's head on it.
        /// </summary>
        /// <remarks>
        /// A room and a shop were the same sign in two colours of text, which is not a
        /// difference you can see from across a map - and the sign carries a shopkeeper's
        /// icon, so a room read as a shop with an odd name until you clicked it. The box is
        /// the same shape for both, because it belongs to the game rather than to this
        /// feature; what changes is the outline, the icon and the ink.
        /// </remarks>
        private static readonly Color RoomBorderColor = new Color(0.020f, 0.361f, 0.529f);

        private static readonly Color RoomInkColor = new Color(0.031f, 0.286f, 0.427f);

        /// <summary>A room you cannot simply walk into, which is worth seeing before the walk.</summary>
        private static readonly Color LockedBorderColor = new Color(0.706f, 0.404f, 0.024f);

        private static readonly Color LockedInkColor = new Color(0.588f, 0.325f, 0.008f);

        public VendTitleBox VendTemplate;
        private Dictionary<int, VendTitleBox> vendingBoxes = new();
        private int selfVendId;

        public bool TryRemovingDialogNpc(int id)
        {
            // if (selfVendId == id)
            // {
            //     selfVendId = -1;
            //     return true;
            // }
            //
            if (!vendingBoxes.Remove(id, out var vend)) 
                return false;
            
            Destroy(vend.gameObject);
            if(vendingBoxes.Count <= 0)
                gameObject.SetActive(false);

            return true;
        }

        public void CreateVendDialog(int npcId, int characterId, GameObject followObject, string title, bool isChatRoom = false)
        {
            // if (characterId == PlayerState.Instance.EntityId)
            // {
            //     selfVendId = npcId;
            //     return; //we don't show our own vend box
            // }

            gameObject.SetActive(true);
            
            var locked = isChatRoom && !string.IsNullOrEmpty(title) && title[0] == LockedMarker;
            if (locked)
                title = title.Substring(1) + LockedSuffix;

            var go = GameObject.Instantiate(VendTemplate.gameObject, transform);
            go.SetActive(true);
            var box = go.GetComponent<VendTitleBox>();
            box.Text.text = title;
            box.FollowObject = followObject;
            box.VendOwnerId = npcId;
            box.IsChatRoom = isChatRoom;
            box.IsLocked = locked;
            if (isChatRoom)
                DressAsRoom(box, locked);
            box.SnapDialog();
            
            vendingBoxes.Add(npcId, box);
        }

        /// <summary>
        /// Turns a shop sign into a room sign, see RoomBorderColor.
        /// </summary>
        /// <remarks>
        /// Done to the copy rather than to the template in the scene, because there is one
        /// template and it has to keep being a shop for every shop that uses it. Everything
        /// is found by walking down from the text, which is the one part this code already
        /// holds a reference to - the box around it is that text's parent, and the icon is
        /// the other picture inside the same box.
        /// </remarks>
        private static void DressAsRoom(VendTitleBox box, bool locked)
        {
            if (box.Text == null)
                return;

            var ink = locked ? LockedInkColor : RoomInkColor;
            box.Text.color = ink;

            var panel = box.Text.transform.parent as RectTransform;
            if (panel == null)
                return;

            var backdrop = panel.GetComponent<Image>();
            if (backdrop != null)
                backdrop.color = Color.white;

            //The icon: the only other picture in the box, and on a shop sign it is a
            //shopkeeper. A room is people, so it becomes a person.
            for (var i = 0; i < panel.childCount; i++)
            {
                var child = panel.GetChild(i);
                if (child == box.Text.transform)
                    continue;

                var icon = child.GetComponent<Image>();
                if (icon == null)
                    continue;

                var person = ModernUiIcons.Person;
                if (person != null)
                {
                    icon.sprite = person;
                    icon.type = Image.Type.Simple;
                }

                icon.color = ink;
                break;
            }

            ModernUiTheme.AddBorder(panel, locked ? LockedBorderColor : RoomBorderColor);
        }

        public void RemoveAllDialogNpcs()
        {
            foreach(var (_, vend) in vendingBoxes)
                Destroy(vend.gameObject);
            
            vendingBoxes.Clear();
            selfVendId = -1;
            gameObject.SetActive(false);
        }
        
    }
}