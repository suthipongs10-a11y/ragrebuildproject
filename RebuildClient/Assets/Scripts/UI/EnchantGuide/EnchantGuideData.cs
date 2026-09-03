using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace Assets.Scripts.UI.EnchantGuide
{
    /// <summary>
    /// Which pool a piece of gear draws from. Mirrors EnchantSlotFamily on the server.
    /// </summary>
    public enum GuideFamily
    {
        Weapon,
        Armour,
        Accessory
    }

    /// <summary>
    /// One row of the stat pool, as the guide talks about it.
    /// </summary>
    /// <remarks>
    /// The six base stats share a band and a family at every tier, so they are one row here
    /// with a weight of six rather than six rows that would say the same thing six times.
    /// Weight is what the row counts for when working out how likely it is to be picked.
    /// </remarks>
    public class GuideStat
    {
        public readonly string Label;
        public readonly int Weight;
        public readonly bool Offensive;
        public readonly bool Defensive;
        public readonly int[] Min;
        public readonly int[] Max;

        public GuideStat(string label, int weight, bool offensive, bool defensive, int[] min, int[] max)
        {
            Label = label;
            Weight = weight;
            Offensive = offensive;
            Defensive = defensive;
            Min = min;
            Max = max;
        }

        public bool OfferedAt(int tier) { return Max[tier] > 0; }

        public bool InPool(GuideFamily family)
        {
            switch (family)
            {
                case GuideFamily.Weapon: return Offensive;
                case GuideFamily.Armour: return Defensive;
                default: return Offensive || Defensive;
            }
        }
    }

    /// <summary>One line of a recipe.</summary>
    public class GuideMaterial
    {
        public readonly string Code;
        public readonly int Count;
        public readonly string Note;

        public GuideMaterial(string code, int count, string note = null)
        {
            Code = code;
            Count = count;
            Note = note;
        }
    }

    public class GuideTier
    {
        public readonly string Thai;
        public readonly string Colour;
        public readonly int Rows;
        public readonly int EmptyPerCent;
        public readonly float Curve;
        public readonly int Zeny;
        public readonly GuideMaterial[] Materials;

        public GuideTier(string thai, string colour, int rows, int emptyPerCent, float curve, int zeny, GuideMaterial[] materials)
        {
            Thai = thai;
            Colour = colour;
            Rows = rows;
            EmptyPerCent = emptyPerCent;
            Curve = curve;
            Zeny = zeny;
            Materials = materials;
        }
    }

    /// <summary>
    /// Everything the guide window says, in numbers.
    /// </summary>
    /// <remarks>
    /// A second copy of the server's tables, which is a thing worth being uneasy about. The
    /// alternative was a packet that ships EnchantTables to the client on request, and that
    /// is the right answer once these numbers stop moving - right now they move every time
    /// the design does, and a packet would mean editing four files instead of one to change
    /// a band.
    ///
    /// What keeps the copy honest: the bands, the curves and the empty rates below are laid
    /// out in the same order and the same shape as EnchantTables.pool and oddsByTier, so the
    /// two files diff against each other by eye. Everything derived from them - the spreads,
    /// the pool sizes, the per-stat odds - is worked out here rather than typed in, so only
    /// the raw numbers can drift, not the arithmetic.
    ///
    /// The recipes have no server copy to drift from yet. The scribe cannot craft, so these
    /// are the design document rather than a mirror of code; when the crafting menu is built
    /// it has to be built from these.
    /// </remarks>
    public static class EnchantGuideData
    {
        public const int TierCount = 4;

        public static readonly GuideTier[] Tiers =
        {
            new GuideTier("ดิน", "#8A6234", 1, 2, 1.5f, 1000, new[]
            {
                new GuideMaterial("Red_Stocking", 20),
                new GuideMaterial("Jellopy", 25),
                new GuideMaterial("Insect_Peeling", 25),
                new GuideMaterial("Shell", 25),
                new GuideMaterial("Stem", 25),
                new GuideMaterial("Single_Cell", 25)
            }),
            new GuideTier("ฟ้า", "#1F6E97", 2, 12, 1.8f, 10000, new[]
            {
                new GuideMaterial("Red_Stocking", 40),
                new GuideMaterial("Cyfar", 50),
                new GuideMaterial("Blue_Hair", 50),
                new GuideMaterial("Sharp_Scale", 50),
                new GuideMaterial("Rotten_Bandage", 50),
                new GuideMaterial("Skel-Bone", 50),
                new GuideMaterial("Opal", 1, "อัญมณีมินิบอส"),
                new GuideMaterial("Amethyst", 1, "อัญมณีมินิบอส"),
                new GuideMaterial("Pearl", 1, "อัญมณีมินิบอส")
            }),
            new GuideTier("สวรรค์", "#8E6E05", 2, 18, 2.2f, 100000, new[]
            {
                new GuideMaterial("Red_Stocking", 100),
                new GuideMaterial("Worn_Out_Page", 100),
                new GuideMaterial("Yellow_Plate", 100),
                new GuideMaterial("Round_Shell", 100),
                new GuideMaterial("Nose_Ring", 100),
                new GuideMaterial("Mud_Lump", 100),
                new GuideMaterial("Gold", 2),
                new GuideMaterial("Cracked_Diamond", 2),
                new GuideMaterial("Toxic_Gas", 1, "ของหลุดจากบอส"),
                new GuideMaterial("Tattered_Clothes", 1, "ของหลุดจากบอส"),
                new GuideMaterial("Black_Dyestuffs", 1, "ของหลุดจากบอส"),
                new GuideMaterial("Card_Dust", 1, "บดการ์ดที่อาลักษณ์")
            }),
            new GuideTier("ตำนาน", "#A32E45", 3, 25, 2.6f, 1000000, new[]
            {
                new GuideMaterial("Red_Stocking", 200),
                new GuideMaterial("Agate", 5),
                new GuideMaterial("Biotite", 5),
                new GuideMaterial("Citrin", 5),
                new GuideMaterial("Muscovite", 5),
                new GuideMaterial("Peridot", 5),
                new GuideMaterial("Phlogopite", 5),
                new GuideMaterial("Pyroxene", 5),
                new GuideMaterial("Rose_Quartz", 5),
                new GuideMaterial("Turquoise", 5),
                new GuideMaterial("Emperium", 5),
                new GuideMaterial("Card_Dust", 5, "บดการ์ดที่อาลักษณ์"),
                new GuideMaterial("Ench_Heaven_Weapon", 1, "คัมภีร์สวรรค์ · ชนิดไหนก็ได้ 1 ใบ")
            })
        };

        //Laid out in the order EnchantTables.pool is: the six anyone can roll, then offensive,
        //then defensive. Index runs ดิน ฟ้า สวรรค์ ตำนาน. A max of zero means the tier does
        //not offer it at all.
        public static readonly GuideStat[] Pool =
        {
            new GuideStat("STR / AGI / VIT / INT / DEX / LUK", 6, true, true, new[] { 1, 2, 3, 4 }, new[] { 2, 3, 4, 5 }),

            new GuideStat("ATK", 1, true, false, new[] { 0, 5, 10, 18 }, new[] { 0, 8, 15, 25 }),
            new GuideStat("MATK", 1, true, false, new[] { 0, 5, 10, 18 }, new[] { 0, 8, 15, 25 }),
            new GuideStat("ASPD (ความเร็วโจมตี)", 1, true, false, new[] { 0, 1, 2, 3 }, new[] { 0, 1, 2, 3 }),
            new GuideStat("HIT", 1, true, false, new[] { 0, 0, 3, 5 }, new[] { 0, 0, 4, 7 }),
            new GuideStat("CRI (อัตราคริ)", 1, true, false, new[] { 0, 0, 1, 3 }, new[] { 0, 0, 2, 4 }),
            new GuideStat("CRI DMG (ความแรงคริ %)", 1, true, false, new[] { 0, 0, 3, 6 }, new[] { 0, 0, 5, 10 }),

            new GuideStat("DEF", 1, false, true, new[] { 0, 1, 3, 5 }, new[] { 0, 2, 4, 6 }),
            new GuideStat("MDEF", 1, false, true, new[] { 0, 1, 3, 5 }, new[] { 0, 2, 4, 6 }),
            new GuideStat("Max HP", 1, false, true, new[] { 0, 50, 100, 200 }, new[] { 0, 80, 150, 300 }),
            new GuideStat("ความเร็วเดิน", 1, false, true, new[] { 0, 3, 5, 8 }, new[] { 0, 3, 5, 8 }),
            new GuideStat("FLEE", 1, false, true, new[] { 0, 0, 3, 5 }, new[] { 0, 0, 4, 7 }),
            new GuideStat("Max SP", 1, false, true, new[] { 0, 0, 20, 50 }, new[] { 0, 0, 30, 80 })
        };

        public static int PoolSize(int tier, GuideFamily family)
        {
            var total = 0;
            foreach (var stat in Pool)
            {
                if (stat.OfferedAt(tier) && stat.InPool(family))
                    total += stat.Weight;
            }

            return total;
        }

        /// <summary>
        /// How often each value in a band actually comes up.
        /// </summary>
        /// <remarks>
        /// The server picks a value by raising a roll of zero to one to the tier's curve and
        /// stretching it across the band, rounding to the nearest whole number. So a value
        /// lands when the stretched roll falls within half a step of it, and turning that
        /// back into the odds of the roll itself is the curve's root of the two edges.
        ///
        /// Bands wider than eight get a summary instead of a list. Max HP at legendary runs
        /// from two hundred to three hundred and nobody wants a hundred and one entries; the
        /// average and the odds of the top value say the same thing in one line.
        /// </remarks>
        public static string Spread(int min, int max, float curve)
        {
            if (min >= max)
                return "";

            var range = max - min;
            var inv = 1f / curve;

            if (range > 8)
            {
                var mean = min + range / (curve + 1f);
                var top = 1f - Mathf.Pow((range - 0.5f) / range, inv);
                return string.Format("เฉลี่ย {0:0} · แตะ {1} ได้ {2:0.##}%", mean, max, top * 100f);
            }

            var sb = new StringBuilder();
            for (var k = 0; k <= range; k++)
            {
                var lo = Mathf.Clamp01((k - 0.5f) / range);
                var hi = Mathf.Clamp01((k + 0.5f) / range);
                var p = Mathf.Pow(hi, inv) - Mathf.Pow(lo, inv);

                if (k > 0)
                    sb.Append(" · ");
                sb.Append(min + k).Append(" → ").Append(Mathf.RoundToInt(p * 100f)).Append('%');
            }

            return sb.ToString();
        }

        /// <summary>One line of the odds sheet, as a row in the list.</summary>
        /// <remarks>
        /// Rows rather than one block of text, because the block did not fit. The window's
        /// text strip is a couple of lines tall and the sheet for a legendary accessory is
        /// eighteen stats long - it ran straight out the bottom of the window and over the
        /// game. The list beside it scrolls, and was already the right shape for this.
        /// </remarks>
        public class GuideOddsRow
        {
            public readonly string Label;
            public readonly string Detail;
            public readonly bool IsHeader;

            public GuideOddsRow(string label, string detail, bool isHeader = false)
            {
                Label = label;
                Detail = detail;
                IsHeader = isHeader;
            }
        }

        public static List<GuideOddsRow> OddsRows(int tier)
        {
            var t = Tiers[tier];
            var rows = new List<GuideOddsRow>();

            rows.Add(new GuideOddsRow(
                string.Format("<b>โอกาสออพ</b> — จาร <b>{0}</b> ช่อง", t.Rows),
                string.Format("ช่องว่าง {0}%", t.EmptyPerCent), true));

            AppendFamily(rows, tier, GuideFamily.Weapon, "อาวุธ");
            AppendFamily(rows, tier, GuideFamily.Armour, "เกราะ · โล่ · หัว · ผ้าคลุม · รองเท้า");
            AppendFamily(rows, tier, GuideFamily.Accessory, "เครื่องประดับ");

            return rows;
        }

        private static void AppendFamily(List<GuideOddsRow> rows, int tier, GuideFamily family, string title)
        {
            var pool = PoolSize(tier, family);
            if (pool <= 0)
                return;

            rows.Add(new GuideOddsRow("<b>" + title + "</b>", "พูล " + pool + " สเตตัส", true));

            foreach (var stat in Pool)
            {
                if (!stat.OfferedAt(tier) || !stat.InPool(family))
                    continue;

                var chance = 100f * stat.Weight / pool;
                var min = stat.Min[tier];
                var max = stat.Max[tier];

                var label = string.Format("<color=#B08A3A>{0}%</color>  {1}  <b>+{2}{3}</b>",
                    chance.ToString("0.#"), stat.Label, min, max > min ? "~" + max : "");

                rows.Add(new GuideOddsRow(label, Spread(min, max, Tiers[tier].Curve)));
            }
        }
    }
}
