using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    /// <summary>
    /// Themes the parts of the interface that belong to the game itself rather than to a
    /// window the player opens: the NPC talk box, the list of replies it offers, and the
    /// minimap. None of these is a WindowBase living in the window container, so the
    /// general sweep never reaches them and each is picked up by name here.
    ///
    /// The minimap image itself is deliberately left alone. It is a photograph of the
    /// real map taken by the lighting tool, so its colours already match the world; a
    /// tint applied here would be the one thing that broke that.
    /// </summary>
    public class ModernHudSkin : MonoBehaviour
    {
        private const float SearchInterval = 0.5f;

        private float searchTimer;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernHudSkin>() != null)
                return;

            var host = new GameObject("ModernHudSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernHudSkin>();
        }

        private void Update()
        {
            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            var dialog = FindFirstObjectByType<DialogWindow>(FindObjectsInactive.Include);
            if (dialog != null && !ModernUiTheme.IsSkinned(dialog.gameObject))
                SkinDialog(dialog);

            var options = FindFirstObjectByType<NpcOptionWindow>(FindObjectsInactive.Include);
            if (options != null && !ModernUiTheme.IsSkinned(options.gameObject))
                SkinOptions(options);

            var minimap = MinimapController.Instance;
            if (minimap != null && !ModernUiTheme.IsSkinned(minimap.gameObject))
                SkinMinimap(minimap);
        }

        private static void SkinDialog(DialogWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            ModernUiTheme.ApplyWindowChrome(win);
            ModernUiTheme.AttachShadow(root);

            if (win.NameBox != null)
            {
                win.NameBox.color = ModernUiTheme.AccentColor;
                win.NameBox.fontSize = ModernUiTheme.SizeValue;
                win.NameBox.fontStyle = FontStyles.Bold;
                win.NameBox.extraPadding = true;
            }

            if (win.TextBox != null)
            {
                //dialogue arrives from the script files carrying its own colour tags, so
                //this only sets what an untagged line falls back to
                win.TextBox.color = ModernUiTheme.NameColor;
                win.TextBox.fontSize = ModernUiTheme.SizeBody;
                win.TextBox.extraPadding = true;
            }

            ModernUiTheme.RecolorLightTexts(root);
            ModernUiTheme.RecolorAccents(root);
            ThaiUiText.ApplyToControls(root);

            Debug.Log("[ModernHudSkin] Retinted the NPC dialog.");
        }

        private static void SkinOptions(NpcOptionWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            ModernUiTheme.ApplyWindowChrome(win);
            ModernUiTheme.AttachShadow(root);

            //every reply the player is offered is cloned from this one, so styling the
            //template covers the choices for every NPC from here on
            if (win.TemplateButton != null)
                StyleOptionButton(win.TemplateButton);

            if (win.ButtonGroup != null)
            {
                var group = win.ButtonGroup.transform;
                for (var i = 0; i < group.childCount; i++)
                    StyleOptionButton(group.GetChild(i).gameObject);
            }

            ModernUiTheme.RecolorLightTexts(root);
            ModernUiTheme.RecolorAccents(root);

            Debug.Log("[ModernHudSkin] Retinted the NPC reply list.");
        }

        private static void StyleOptionButton(GameObject target)
        {
            if (target == null)
                return;

            var image = target.GetComponent<Image>();
            if (image != null)
            {
                image.sprite = ModernUiTheme.RoundedSprite;
                image.type = Image.Type.Sliced;
                image.color = ModernUiTheme.CardColor;
            }

            foreach (var label in target.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                label.color = ModernUiTheme.AccentColor;
                label.fontSize = ModernUiTheme.SizeBody;
                label.fontStyle = FontStyles.Bold;
                label.extraPadding = true;
            }
        }

        private static void SkinMinimap(MinimapController map)
        {
            ModernUiTheme.MarkSkinned(map.gameObject);

            //the controller does not have to be the one holding the layout rect, so this
            //checks rather than casts
            var root = map.transform as RectTransform;
            if (root == null)
                return;

            //a soft plate a few pixels proud of the map on every side, which reads as a
            //frame without anything having to be measured or moved
            if (root.Find("ModernMinimapFrame") == null)
            {
                var frame = ModernUiTheme.CreateCard(root, "ModernMinimapFrame", ModernUiTheme.CardDeepColor);
                ModernUiTheme.Stretch(frame, -6, -6, 6, 6);
                frame.GetComponent<Image>().raycastTarget = false;
                frame.SetAsFirstSibling();
            }

            ModernUiTheme.StyleSliders(root);

            Debug.Log("[ModernHudSkin] Framed the minimap.");
        }
    }
}
