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
        private struct Entry
        {
            public string Name;
            public int Rank;
        }

        private static readonly Dictionary<Guid, Entry> names = new Dictionary<Guid, Entry>();

        /// <summary>
        /// The titles a smith earns, worst to best.
        /// </summary>
        /// <remarks>
        /// Kept on this side rather than sent down with the name so the wording can change
        /// without every weapon ever forged having to be re-stamped. The server sends the
        /// rank as a number and has no opinion about what it is called.
        /// </remarks>
        private static readonly string[] rankTitles =
        {
            null,
            "ช่างฝึกหัด",
            "ช่างตีเหล็ก",
            "ช่างเอก",
            "ตำนานเหล็กไฟ"
        };

        //Bronze, silver, gold, then the one that is meant to be seen across a marketplace.
        private static readonly string[] rankColors =
        {
            null,
            "#B87333",
            "#C0C0C0",
            "#D4A017",
            "#FF8C00"
        };

        public static void Set(Guid uniqueId, string forger, int rank)
        {
            if (uniqueId == Guid.Empty || string.IsNullOrEmpty(forger))
                return;

            names[uniqueId] = new Entry { Name = forger, Rank = rank };
        }

        /// <summary>The smith who made it, or null if nobody did.</summary>
        public static string Get(Guid uniqueId)
        {
            if (uniqueId == Guid.Empty)
                return null;

            return names.TryGetValue(uniqueId, out var entry) ? entry.Name : null;
        }

        /// <summary>What that smith had earned when they made it. Zero for a nameless one.</summary>
        public static int RankOf(Guid uniqueId)
        {
            if (uniqueId == Guid.Empty)
                return 0;

            return names.TryGetValue(uniqueId, out var entry) ? entry.Rank : 0;
        }

        /// <summary>The title itself, already coloured, or null below the first rank.</summary>
        public static string TitleFor(int rank)
        {
            if (rank <= 0 || rank >= rankTitles.Length || rankTitles[rank] == null)
                return null;

            return "<color=" + rankColors[rank] + ">" + rankTitles[rank] + "</color>";
        }

        /// <summary>Forgotten on logout, since the next character carries different things.</summary>
        public static void Clear() => names.Clear();
    }
}
