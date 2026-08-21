using System;
using TMPro;
using UnityEngine;

namespace Assets.Scripts.UI.Hud
{
    public class TextInputWindow : MonoBehaviour
    {
        public TextMeshProUGUI TextTitle;
        public TMP_InputField TextInput;
        private Transform container;
        private Action<string> onSubmitAction;

        /// <summary>
        /// Bumped every time a prompt opens, so Submit can tell whether the answer it has
        /// just delivered went on to ask another question.
        /// </summary>
        private int generation;

        public void Awake()
        {
            container = transform.parent;
        }

        public void HideInputWindow()
        {
            gameObject.SetActive(false);
            CameraFollower.Instance.InTextInputBox = false;
            onSubmitAction = null;
        }

        public void BeginTextInput(string description, Action<string> onSubmit)
        {
            generation++;
            gameObject.SetActive(true);
            onSubmitAction = onSubmit;
            transform.SetAsLastSibling();
            TextTitle.text = description;
            TextInput.text = $"";
            TextInput.ActivateInputField();
            CameraFollower.Instance.InTextInputBox = true;
        }

        /// <summary>
        /// Hands the answer over, and closes only if the answer did not turn into another
        /// question.
        ///
        /// Asking how many and then for how much is one errand, and it was being cut in
        /// half: the second prompt opened inside the callback and was closed again the
        /// instant it returned, so the window simply vanished and nothing happened. The
        /// action is cleared before the callback rather than after, or the new one set by
        /// a second prompt would be thrown away here.
        /// </summary>
        public void Submit()
        {
            var opened = generation;
            var action = onSubmitAction;
            onSubmitAction = null;

            if (action != null)
                action(TextInput.text);

            if (generation == opened)
                HideInputWindow();
        }
        
        public void Update()
        {
            if (transform != container.GetChild(container.childCount - 1))
                HideInputWindow();
        }
    }
}