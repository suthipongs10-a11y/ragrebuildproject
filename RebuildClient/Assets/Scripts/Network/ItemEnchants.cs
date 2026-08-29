using System;
using System.Collections.Generic;
using System.Text;
using RebuildSharedData.Enum.EntityStats;

namespace Assets.Scripts.Network
{
    /// <summary>One rolled option on a piece of equipment.</summary>
    public struct EnchantOptionEntry
    {
        public CharacterStat Stat;
        public int Value;
    }

    /// <summary>The options on one item, and which scroll put them there.</summary>
    public class ItemEnchantEntry
    {
        public int Tier;
        public List<EnchantOptionEntry> Options;
    }

    /// <summary>
    /// The enchant options on the items this character can see.
    ///
    /// Kept beside the items rather than inside them for the same reason the forger's name
    /// is: a UniqueItem is a fixed forty bytes with every one of them already spoken for.
    /// The server sends these keyed on the guid each item already carries and this keeps
    /// what it was told.
    ///
    /// Unlike ForgedNames this can also be told to forget something. A forger is set once
    /// and never changes, but options are re-rolled and wiped, and an item whose options
    /// were cleared has to stop reading as enchanted.
    /// </summary>
    public static class ItemEnchants
    {
        private static readonly Dictionary<Guid, ItemEnchantEntry> entries = new Dictionary<Guid, ItemEnchantEntry>();
        private static readonly StringBuilder sb = new StringBuilder();

        //The tier colours, matching the design document so a scroll looks the same in the
        //plan as it does in the game. Chosen for the light panel the detail window uses.
        private static readonly string[] tierColors =
        {
            "#66627E", //nothing, which should never be drawn
            "#8A6234", //ดิน
            "#1F6E97", //ฟ้า
            "#8E6E05", //สวรรค์
            "#A32E45"  //ตำนาน
        };

        private static readonly string[] tierNames = { "", "ดิน", "ฟ้า", "สวรรค์", "ตำนาน" };

        public static void Set(Guid uniqueId, ItemEnchantEntry entry)
        {
            if (uniqueId == Guid.Empty)
                return;

            //No options means the item was reset, and a reset item is one that has never
            //been enchanted as far as everything reading this is concerned.
            if (entry == null || entry.Options == null || entry.Options.Count == 0)
            {
                entries.Remove(uniqueId);
                return;
            }

            entries[uniqueId] = entry;
        }

        public static ItemEnchantEntry Get(Guid uniqueId)
        {
            if (uniqueId == Guid.Empty)
                return null;

            return entries.TryGetValue(uniqueId, out var entry) ? entry : null;
        }

        /// <summary>Forgotten on logout, since the next character carries different things.</summary>
        public static void Clear() => entries.Clear();

        /// <summary>
        /// The block of lines to hang under an item's description, or null for an item
        /// with no options on it.
        /// </summary>
        public static string DescribeFor(Guid uniqueId)
        {
            var entry = Get(uniqueId);
            if (entry == null)
                return null;

            var tier = entry.Tier;
            if (tier < 0 || tier >= tierColors.Length)
                tier = 0;

            sb.Clear();
            sb.Append("\n<color=").Append(tierColors[tier]).Append(">[ออพชั่นเสริม · ")
              .Append(tierNames[tier]).Append("]</color>");

            foreach (var option in entry.Options)
            {
                sb.Append("\n  <color=").Append(tierColors[tier]).Append(">")
                  .Append(NameOf(option.Stat)).Append(' ')
                  .Append(option.Value >= 0 ? "+" : "").Append(option.Value)
                  .Append("</color>");
            }

            return sb.ToString();
        }

        /// <summary>
        /// The short label a stat is shown under.
        /// </summary>
        /// <remarks>
        /// Only the stats a scroll can roll are named here. Anything else falls back to the
        /// enum's own name, which is not pretty but is never wrong - and it means adding a
        /// stat to the roll table does not silently print nothing.
        /// </remarks>
        private static string NameOf(CharacterStat stat)
        {
            switch (stat)
            {
                case CharacterStat.AddStr: return "STR";
                case CharacterStat.AddAgi: return "AGI";
                case CharacterStat.AddVit: return "VIT";
                case CharacterStat.AddInt: return "INT";
                case CharacterStat.AddDex: return "DEX";
                case CharacterStat.AddLuk: return "LUK";
                case CharacterStat.AddAttackPower: return "ATK";
                case CharacterStat.AddMagicAttackPower: return "MATK";
                case CharacterStat.AddDef: return "DEF";
                case CharacterStat.AddMDef: return "MDEF";
                case CharacterStat.AddMaxHp: return "MaxHP";
                case CharacterStat.AddMaxSp: return "MaxSP";
                case CharacterStat.AddCrit: return "CRIT";
                case CharacterStat.AddFlee: return "FLEE";
                case CharacterStat.AddHit: return "HIT";
                case CharacterStat.AspdBonus: return "ASPD";
                case CharacterStat.MoveSpeedBonus: return "Speed";
                default: return stat.ToString();
            }
        }
    }
}
