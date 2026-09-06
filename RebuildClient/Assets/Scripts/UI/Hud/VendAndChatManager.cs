using System.Collections.Generic;
using UnityEngine;

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

        /// <summary>Locked rooms wear a padlock in place of the marker they arrived with.</summary>
        private const string LockedPrefix = "* ";

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
                title = LockedPrefix + title.Substring(1);

            var go = GameObject.Instantiate(VendTemplate.gameObject, transform);
            go.SetActive(true);
            var box = go.GetComponent<VendTitleBox>();
            box.Text.text = title;
            box.FollowObject = followObject;
            box.VendOwnerId = npcId;
            box.IsChatRoom = isChatRoom;
            box.IsLocked = locked;
            if (isChatRoom)
                //tinted so a room doesn't read as a shop, and a locked one differently
                //again, because walking up to one and being turned away is the one thing
                //the sign can spare you
                box.Text.color = locked ? new Color(1f, 0.78f, 0.42f) : new Color(0.55f, 0.85f, 1f);
            box.SnapDialog();
            
            vendingBoxes.Add(npcId, box);
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