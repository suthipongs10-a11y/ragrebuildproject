using Assets.Scripts.UI.ConfigWindow;
using UnityEngine;

namespace Assets.Scripts.UI.Mobile
{
    /// <summary>
    /// The one place that decides whether this is a phone.
    ///
    /// It used to be decided twice, and one of the two asked <c>Input.touchSupported</c>.
    /// That is not a question about the screen, it is a question about what the machine can
    /// do, and the answer is yes on a laptop with a touchscreen and yes in most browsers on
    /// any machine at all - so a desktop got the phone's interface and lost its own.
    ///
    /// What actually separates the two is the shape of the screen. A phone held upright is
    /// taller than it is wide and a desktop window is not, and that is a fact about the
    /// thing the layout has to fit rather than about the hardware behind it.
    ///
    /// A heuristic that has been wrong once is worth being able to overrule, so the answer
    /// can be pinned either way from chat and the choice is remembered.
    /// </summary>
    public static class MobileMode
    {
        public const int Auto = 0;
        public const int AlwaysOn = 1;
        public const int AlwaysOff = 2;

        /// <summary>
        /// Whether the phone layout and the touch controls should be up.
        ///
        /// Read every time rather than cached: a browser window can be dragged from wide to
        /// tall without the page reloading, and a phone can be turned over.
        /// </summary>
        public static bool IsActive
        {
            get
            {
                switch (Setting)
                {
                    case AlwaysOn: return true;
                    case AlwaysOff: return false;
                    default: return Application.isMobilePlatform || Screen.height > Screen.width;
                }
            }
        }

        /// <summary>
        /// What the player pinned it to, or Auto. Kept in the saved config so it survives a
        /// reload, and read through here so nothing has to cope with the config being unbuilt.
        /// </summary>
        public static int Setting
        {
            get
            {
                GameConfig.InitializeIfNecessary();
                return GameConfig.Data != null ? GameConfig.Data.MobileUiMode : Auto;
            }
            set
            {
                GameConfig.InitializeIfNecessary();
                if (GameConfig.Data == null)
                    return;

                GameConfig.Data.MobileUiMode = value;
                GameConfig.SaveConfig();
            }
        }

        public static string Describe()
        {
            switch (Setting)
            {
                case AlwaysOn: return "เปิดตลอด";
                case AlwaysOff: return "ปิดตลอด";
                default: return $"อัตโนมัติ (ตอนนี้{(IsActive ? "เปิด" : "ปิด")})";
            }
        }
    }
}
