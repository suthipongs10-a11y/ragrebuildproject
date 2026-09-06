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
    /// The shape of the screen answers it for a phone held upright - taller than it is
    /// wide, which a desktop window is not - but a phone turned sideways is the same shape
    /// as a laptop, and going by shape alone that phone lost its controls the moment it was
    /// rotated. Sideways is also how most people play, so it lost them most of the time.
    ///
    /// What tells the two apart is the pointer rather than the screen: a phone reports
    /// touch and no mouse, and a laptop with a touchscreen reports both. That is the test
    /// the first version should have been, and the shape is left underneath it as the
    /// fallback for anything that reports neither.
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
                    default: return IsPhone;
                }
            }
        }

        /// <summary>
        /// Whether this looks like a phone or a tablet, whichever way it is being held.
        /// </summary>
        /// <remarks>
        /// Four questions, in order of how much they can be trusted. A native mobile build
        /// says so outright. A browser that knows it is on a handheld says so through the
        /// device type, which is what the WebGL player fills in from the user agent. Failing
        /// both, touch with no mouse attached is a phone, while touch with a mouse is a
        /// laptop whose screen happens to be touchable - the distinction the first version
        /// of this missed. And with none of that answered, the shape of the screen decides,
        /// which still catches a phone held upright.
        /// </remarks>
        public static bool IsPhone
        {
            get
            {
                if (Application.isMobilePlatform)
                    return true;
                if (SystemInfo.deviceType == DeviceType.Handheld)
                    return true;
                if (Input.touchSupported && !Input.mousePresent)
                    return true;
                return Screen.height > Screen.width;
            }
        }

        /// <summary>
        /// Whether the phone is being held sideways, which is a different layout rather than
        /// a different set of controls.
        /// </summary>
        public static bool IsLandscape => Screen.width > Screen.height;

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
