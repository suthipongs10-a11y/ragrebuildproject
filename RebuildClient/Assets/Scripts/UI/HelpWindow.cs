using Assets.Scripts.UI;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// The window behind the manual button, which is this server's welcome poster.
/// </summary>
/// <remarks>
/// It used to hold the upstream project's changelog - a list of English patch notes
/// about card fixes and auto-spell timings, addressed to people running that project,
/// which is not what anybody opening the manual here is looking for.
///
/// The poster covers the notes rather than deleting them. UiManager still fills that
/// text at startup and the scroll view is still a scene object this code did not build;
/// laying a picture over the top asks nothing of a hierarchy it cannot see, and leaves
/// the notes one deleted line away from coming back.
/// </remarks>
public class HelpWindow : WindowBase
{
    /// <summary>Assets/Resources/CustomUI/WelcomePoster.png, without the extension.</summary>
    private const string PosterResource = "CustomUI/WelcomePoster";

    private const string CommunityUrl = "https://www.facebook.com/groups/2443940029461323";

    //portrait, because the poster is - the fit in WindowBase shrinks this on a phone
    private const float PosterWindowWidth = 430f;
    private const float PosterWindowHeight = 600f;

    private const float TitleBarHeight = 36f;
    private const float PosterInset = 6f;
    private const float ButtonWidth = 260f;
    private const float ButtonHeight = 46f;
    private const float ButtonBottomGap = 18f;

    private bool built;

    public override void ShowWindow()
    {
        base.ShowWindow();
        BuildPoster();

        //again after the size has changed, or the window is fitted at the size it was
        FitWindowIntoPlayArea();
    }

    private void BuildPoster()
    {
        if (built)
            return;

        built = true; //one attempt either way - a missing file will not be there next time

        var poster = Resources.Load<Sprite>(PosterResource);
        if (poster == null)
        {
            //The usual cause is the import settings rather than a missing file: Unity brings
            //a dropped-in png in as a plain Texture, and Resources.Load<Sprite> answers null
            //for one of those without complaining. Said out loud, because the alternative is
            //a window that silently keeps showing somebody else's changelog.
            if (Resources.Load<Texture2D>(PosterResource) != null)
                Debug.LogWarning($"[HelpWindow] Found {PosterResource} but it is not a sprite. "
                                 + "Select it in the Project window, set Texture Type to 'Sprite (2D and UI)', and Apply.");
            else
                Debug.Log($"[HelpWindow] No poster at Assets/Resources/{PosterResource} - keeping the patch notes.");
            return;
        }

        var rect = (RectTransform)transform;
        rect.sizeDelta = new Vector2(PosterWindowWidth, PosterWindowHeight);

        //Last child, so it is over the notes and over the scroll bar beside them. The title
        //bar is left uncovered - the close button lives there.
        var go = new GameObject("WelcomePoster", typeof(Image));
        go.transform.SetParent(transform, false);
        go.transform.SetAsLastSibling();

        var image = go.GetComponent<Image>();
        image.sprite = poster;
        image.preserveAspect = true;
        image.raycastTarget = true; //also what stops a drag landing on the notes underneath

        ModernUiTheme.Stretch((RectTransform)go.transform,
            PosterInset, PosterInset, -PosterInset, -TitleBarHeight);

        var button = ModernUiTheme.CreateButton(go.transform, "CommunityLink", "เข้าร่วมกลุ่มพูดคุย",
            ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor, ModernUiTheme.SizeSubtitle);

        var buttonRect = (RectTransform)button.transform;
        ModernUiTheme.Place(buttonRect, new Vector2(0.5f, 0f),
            new Vector2(0f, ButtonBottomGap), new Vector2(ButtonWidth, ButtonHeight));

        var face = button.GetComponent<Image>();
        if (face != null)
        {
            face.sprite = ModernUiTheme.RoundedSprite;
            face.type = Image.Type.Sliced;
        }

        ModernUiTheme.AddBorder(buttonRect, ModernUiTheme.AccentTextColor);
        button.onClick.AddListener(() => Application.OpenURL(CommunityUrl));
    }
}
