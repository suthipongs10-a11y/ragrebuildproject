using System;
using System.Collections.Generic;

namespace Assets.Scripts.Network
{
    /// <summary>
    /// Who forged the weapons this character is carrying.
    ///
    /// The name is not in the item. A UniqueItem is a fixed forty bytes with every one of
    /// them spoken for, so the server sends the names beside the items keyed on the guid
    /// each item already has, and this keeps what it was told.
    ///
    /// Only ever added to. An item that leaves the bag leaves its name behind, which costs
    /// a few dozen bytes and means a weapon looked at twice reads the same both times.
    /// </summary>
    public static class ForgedNames
    {
        private static readonly Dictionary<Guid, string> names = new Dictionary<Guid, string>();

        public static void Set(Guid uniqueId, string forger)
        {
            if (uniqueId == Guid.Empty || string.IsNullOrEmpty(forger))
                return;

            names[uniqueId] = forger;
        }

        /// <summary>The smith who made it, or null if nobody did.</summary>
        public static string Get(Guid uniqueId)
        {
            if (uniqueId == Guid.Empty)
                return null;

            return names.TryGetValue(uniqueId, out var name) ? name : null;
        }

        /// <summary>Forgotten on logout, since the next character carries different things.</summary>
        public static void Clear() => names.Clear();
    }
}
