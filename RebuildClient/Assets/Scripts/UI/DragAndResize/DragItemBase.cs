using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    public class DragItemBase : MonoBehaviour
    {
        public Image Image;
        public CanvasGroup CanvasGroup;
        public TextMeshProUGUI CountText;
        public DragItemType Type;
        public Sprite Sprite;
        public int ItemId;
        public int ItemCount;

        public void Assign(DragItemBase orig) => Assign(orig.Type, orig.Sprite, orig.ItemId, orig.ItemCount);
        
        public void Assign(DragItemType type, Sprite sprite, int itemId, int count)
        {
            Type = type;
            Sprite = sprite;
            ItemId = itemId;
            UpdateCount(count);

            if (Image != null)
            {
                Image.gameObject.SetActive(true);
                Image.sprite = sprite;
                if (Sprite != null)
                    Image.rectTransform.sizeDelta = Sprite.rect.size * 2;
            }
        }

        public void HideCount()
        {
            //Guarded like every other method that touches this label. It was the only one
            //that was not, and that mattered: equipping a piece of gear hides its stack
            //count first and sends the equip second, so an entry that had lost its label
            //threw here and the equip was never sent. Ammunition took the other branch and
            //still worked, which is what made it look like a problem with gear.
            if (CountText == null)
                return;

            CountText.gameObject.SetActive(false);
        }

        public void SetEquipped()
        {
            if (CountText == null)
                return;
                
            CountText.gameObject.SetActive(true);
            CountText.text = "E";
        }

        public void BlueCount()
        {
            if (CountText == null)
                return;
            
            CountText.text = $"<color=#0000ed>{CountText.text}</color>";
        }
        
        public void RedCount()
        {
            if (CountText == null)
                return;
            
            CountText.text = $"<color=#FF3333>{CountText.text}</color>";
        }
        
        public void UpdateCount(int count)
        {
            // Debug.Log($"Update item count for {ItemId} to {count}");
            ItemCount = count;
            if (CountText != null)
            {
                if ((count <= 0 && Type == DragItemType.Skill) || Type == DragItemType.Equipment)
                    CountText.gameObject.SetActive(false);
                else
                {
                    CountText.gameObject.SetActive(true);
                    CountText.text = count.ToString();
                }
            }
        }

        public void Empty()
        {
            Image.sprite = null;
            Image.gameObject.SetActive(false);
            HideCount();
            Type = DragItemType.None;
            ItemCount = 0;
            ItemId = 0;
        }

        public void Clear()
        {
            Type = DragItemType.None;
            gameObject.SetActive(false);
        }
    }
}