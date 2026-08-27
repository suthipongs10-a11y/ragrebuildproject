using System.Collections.Generic;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Assets.Scripts.UI.Utility;

namespace Assets.Scripts.UI.Hud
{
    public class ItemObtainedToast : MonoBehaviour
    {
        public GameObject Container;
        public RectTransform Rect;
        public TextMeshProUGUI Text;
        public Image Icon;

        private float endTime;

        /// <summary>
        /// What is still waiting to be shown, oldest first.
        /// </summary>
        /// <remarks>
        /// There is one badge and it used to be written straight over. That is fine for a
        /// pickup off the ground, which arrives on its own - but a quest reward arrives as
        /// four or five items in the same frame, and each one overwrote the last before a
        /// frame had been drawn. Only the final item was ever seen, and the reward looked
        /// like one item instead of five.
        ///
        /// Shown in turn instead, and faster when several are waiting, so a seven item reward
        /// takes a few seconds rather than twenty.
        /// </remarks>
        private readonly Queue<Pending> pending = new Queue<Pending>();

        private readonly struct Pending
        {
            public readonly Sprite Icon;
            public readonly string Text;

            public Pending(Sprite icon, string text)
            {
                Icon = icon;
                Text = text;
            }
        }

        private const float HoldTime = 2.4f;
        private const float HurriedHoldTime = 0.9f;

        public void Awake()
        {
            Container.SetActive(false);
        }

        public void SetText(InventoryItem inventoryItem, int itemCount, bool chatOnly = false)
        {
            var name = inventoryItem.ProperName();

            if (itemCount == 1)
                CameraFollower.Instance.AppendChatText($"{ChatColor.Item}ได้รับ {name}</color>");
            else
                CameraFollower.Instance.AppendChatText($"{ChatColor.Item}ได้รับ {name} x{itemCount}</color>");

            if (chatOnly)
                return;

            var loader = ClientDataLoader.Instance;
            Sprite icon = null;
            if (loader != null)
            {
                icon = loader.GetIconAtlasSprite(inventoryItem.ItemData.Sprite);
                if (icon == null)
                    icon = loader.GetIconAtlasSprite("Apple");
            }

            pending.Enqueue(new Pending(icon, itemCount == 1 ? $"ได้รับ {name}" : $"ได้รับ {name} x{itemCount}"));

            //Straight to the screen when nothing is up, so a single pickup is as immediate as
            //it ever was. Anything arriving behind it waits its turn.
            if (!Container.activeSelf)
                ShowNext();
        }

        private void ShowNext()
        {
            if (pending.Count == 0)
            {
                Container.SetActive(false);
                return;
            }

            var next = pending.Dequeue();

            Icon.sprite = next.Icon;
            Icon.enabled = next.Icon != null;
            if (next.Icon != null)
                Icon.rectTransform.sizeDelta = next.Icon.rect.size * 2;

            Text.text = next.Text;

            Container.SetActive(true);
            endTime = Time.timeSinceLevelLoad + (pending.Count > 0 ? HurriedHoldTime : HoldTime);

            LayoutRebuilder.ForceRebuildLayoutImmediate(Rect);
            Text.ForceMeshUpdate();
        }

        public void Update()
        {
            if (endTime > Time.timeSinceLevelLoad)
                return;

            if (Container.activeSelf || pending.Count > 0)
                ShowNext();
        }
    }
}
