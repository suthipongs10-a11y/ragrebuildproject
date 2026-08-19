namespace Assets.Scripts.UI
{
    /// <summary>
    /// What the cursor should be while the pointer is over a particular piece of interface.
    ///
    /// The cursor is decided once a frame from what the mouse is over in the world, and
    /// anything over the interface is "over UI" - one state, whatever the thing is. But a
    /// shop sign is a thing you click, and a cursor that does not say so is a button nobody
    /// knows is a button.
    ///
    /// So a UI element claims the cursor while the pointer is on it and gives it back when
    /// it leaves. Claiming is by object, not a plain flag: two overlapping elements would
    /// otherwise have the one leaving clear the one being entered, and which of those two
    /// events arrives second is not something to depend on.
    /// </summary>
    public static class UiCursorOverride
    {
        private static object owner;
        private static GameCursorMode mode;

        public static bool HasOverride => owner != null;
        public static GameCursorMode Mode => mode;

        public static void Claim(object by, GameCursorMode cursor)
        {
            owner = by;
            mode = cursor;
        }

        /// <summary>Gives it back, but only if this is still the thing holding it.</summary>
        public static void Release(object by)
        {
            if (ReferenceEquals(owner, by))
                owner = null;
        }

        /// <summary>For anything that tears the interface down under a resting pointer.</summary>
        public static void Clear() => owner = null;
    }
}
