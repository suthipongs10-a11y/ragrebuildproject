using Assets.Scripts.Sprites;
using RebuildSharedData.Util;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Assets.Scripts.UI.TitleScreen
{
    public class CharacterSelectPlayerButton : UIBehaviour, IPointerClickHandler
    {
        public CharacterSelectWindow Parent;
        public Button Button;
        public TextMeshProUGUI UnavailableText;
        public UiPlayerSprite PlayerSprite;

        public Sprite SelectedSprite;
        public Sprite UnselectedSprite;

        /// <summary>
        /// The name and the place, written on the card itself. Built by the skin rather than
        /// by the prefab, so a slot without one behaves exactly as it always did.
        /// </summary>
        /// <remarks>
        /// The picker used to name only the character that happened to be highlighted, in a
        /// panel underneath. Three cards that look alike and one label somewhere else is a
        /// screen you have to click through to read, and the one thing anybody wants from it
        /// is to find their character.
        /// </remarks>
        [System.NonSerialized] public TextMeshProUGUI SlotNameLabel;
        [System.NonSerialized] public TextMeshProUGUI SlotMapLabel;

        private ClientCharacterSummary characterSummary;

        private void WriteSlotLabels(string name, string map)
        {
            if (SlotNameLabel != null)
                SlotNameLabel.text = name ?? string.Empty;

            if (SlotMapLabel != null)
                SlotMapLabel.text = map ?? string.Empty;
        }

        public void SetAsUnavailable()
        {
            UnavailableText.gameObject.SetActive(true);
            var spriteState = Button.spriteState;
            spriteState.disabledSprite = UnselectedSprite;
            Button.spriteState = spriteState;
            Button.interactable = false;
        }

        public void PrepareEmptySlot(bool isSelected)
        {
            WriteSlotLabels("ช่องว่าง", "สร้างตัวละครใหม่");
            UnavailableText.gameObject.SetActive(false);
            var spriteState = Button.spriteState;
            spriteState.disabledSprite = SelectedSprite;
            Button.spriteState = spriteState;
            Button.interactable = !isSelected;
            PlayerSprite.gameObject.SetActive(false);
        }

        public void PrepareCharacterEntry(ClientCharacterSummary summary, bool isSelected)
        {
            if (summary == null)
            {
                PrepareEmptySlot(isSelected);
                return;
            }

            characterSummary = summary;
            var spriteState = Button.spriteState;
            spriteState.disabledSprite = SelectedSprite;
            Button.spriteState = spriteState;
            Button.interactable = !isSelected;

            var loader = Assets.Scripts.Sprites.ClientDataLoader.Instance;
            WriteSlotLabels(summary.Name,
                loader != null ? loader.GetFullNameForMap(summary.Map) : summary.Map);

            if (summary.SummaryData == null)
            {
                characterSummary = summary;
                UnavailableText.gameObject.SetActive(true);
                UnavailableText.text = "Appearance Data Unavailable";
                return;
            }

            UnavailableText.gameObject.SetActive(false);
            PlayerSprite.gameObject.SetActive(true);
            
            var isMale = summary.SummaryData[(int)PlayerSummaryData.Gender] == 0;
            var body = summary.SummaryData[(int)PlayerSummaryData.JobId];
            var head = summary.SummaryData[(int)PlayerSummaryData.HeadId];
            var hair = summary.SummaryData[(int)PlayerSummaryData.HairColor];
            var headgear1 = summary.SummaryData[(int)PlayerSummaryData.Headgear1];
            var headgear2 = summary.SummaryData[(int)PlayerSummaryData.Headgear2];
            var headgear3 = summary.SummaryData[(int)PlayerSummaryData.Headgear3];

            PlayerSprite.PrepareDisplayPlayerCharacter(body, head, hair, headgear1, headgear2, headgear3, isMale);
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (eventData.clickCount >= 2)
                Parent.ClickOk();
        }
    }
}