using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Data.CsvDataTypes;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// The one equipment slot a scroll is written for.
/// </summary>
/// <remarks>
/// Eight, not one. A scroll that worked on anything would make the whole grind a single
/// currency: craft, use on whatever you happen to be holding, done. Naming the slot on the
/// scroll means the thing a player is short of is a particular scroll rather than scrolls
/// in general, which is what makes them worth trading.
///
/// One accessory rather than two. The game has two accessory slots but no left and right
/// accessory: a ring is a ring, it goes in whichever of the two is free, and nothing in the
/// item data or the equip code tells one side from the other. Two scrolls for it would have
/// been two names for the same thing.
///
/// Garment has no scroll on purpose: it is not in the list this was built from. The tables
/// below take one more entry each if it ever should be.
/// </remarks>
public enum EnchantScrollSlot : byte
{
    Weapon,
    Armour,
    Shield,
    HeadTop,
    HeadMid,
    HeadLow,
    Shoes,
    Accessory
}

/// <summary>
/// Which scroll is which, what it goes on, and which one the scribe hands over.
/// </summary>
public static class EnchantScrolls
{
    /// <summary>The code of the scroll that wipes options instead of rolling them.</summary>
    public const string BlankScrollCode = "Ench_Blank";

    /// <summary>The slots, in the order the item ids run.</summary>
    private static readonly EnchantScrollSlot[] slots =
    [
        EnchantScrollSlot.Weapon,
        EnchantScrollSlot.Armour,
        EnchantScrollSlot.Shield,
        EnchantScrollSlot.HeadTop,
        EnchantScrollSlot.HeadMid,
        EnchantScrollSlot.HeadLow,
        EnchantScrollSlot.Shoes,
        EnchantScrollSlot.Accessory
    ];

    /// <summary>The tail of the item code for each slot, matching ItemsUsable.csv.</summary>
    private static readonly string[] slotCodes =
        ["Weapon", "Armour", "Shield", "HeadTop", "HeadMid", "HeadLow", "Shoes", "Accessory"];

    /// <summary>What to call the slot when talking to the player.</summary>
    private static readonly string[] slotNames =
    [
        "อาวุธ", "ชุดเกราะ", "โล่", "ส่วนหัว Top", "ส่วนหัว Middle", "ส่วนหัว Low",
        "รองเท้า", "เครื่องประดับ"
    ];

    /// <summary>
    /// How often the scribe writes each slot, out of a hundred.
    /// </summary>
    /// <remarks>
    /// The crafting recipe is the same whichever scroll comes out, so this is the only place
    /// the scroll a player actually wants is made expensive. The accessory carries both stat
    /// pools and is the strongest thing to enchant, and the two head slots below the top one
    /// are worth having for the same reason a mid headgear is: they are slots most people
    /// leave empty. Those three are a twentieth each; the other five split the rest evenly.
    ///
    /// Adds up to a hundred on purpose, so the numbers here are the percentages in the
    /// dialogue without anybody having to work them out again.
    /// </remarks>
    private static readonly int[] slotWeights = [17, 17, 17, 17, 5, 5, 17, 5];

    private const int WeightTotal = 100;

    public static ReadOnlySpan<EnchantScrollSlot> AllSlots => slots;

    public static string CodeFor(EnchantTier tier, EnchantScrollSlot slot) =>
        $"Ench_{tier}_{slotCodes[(int)slot]}";

    public static string NameOf(EnchantScrollSlot slot) => slotNames[(int)slot];

    public static int WeightOf(EnchantScrollSlot slot) => slotWeights[(int)slot];

    /// <summary>
    /// What this item does when used on another item, or false if it is not a scroll.
    /// </summary>
    /// <remarks>
    /// Reads the code rather than keeping a table of thirty-seven item ids beside the csv
    /// that already has them. The codes are generated from the same two lists the item rows
    /// were, so the two cannot drift apart without the lookup failing loudly on the first
    /// use rather than quietly enchanting the wrong slot.
    /// </remarks>
    public static bool TryRead(string code, out EnchantTier tier, out EnchantScrollSlot slot, out bool isBlank)
    {
        tier = EnchantTier.None;
        slot = EnchantScrollSlot.Weapon;
        isBlank = code == BlankScrollCode;

        if (isBlank)
            return true;

        for (var t = EnchantTier.Earth; t <= EnchantTier.Legend; t++)
        {
            for (var s = 0; s < slots.Length; s++)
            {
                if (code != CodeFor(t, slots[s]))
                    continue;

                tier = t;
                slot = slots[s];
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// A slot typed by hand, for the gm commands. Short names as well as the code ones.
    /// </summary>
    public static bool TryReadSlotName(string text, out EnchantScrollSlot slot)
    {
        slot = EnchantScrollSlot.Weapon;

        switch (text.ToLowerInvariant())
        {
            case "weapon": return true;
            case "armour":
            case "armor":
            case "body": slot = EnchantScrollSlot.Armour; return true;
            case "shield": slot = EnchantScrollSlot.Shield; return true;
            case "headtop":
            case "top": slot = EnchantScrollSlot.HeadTop; return true;
            case "headmid":
            case "mid": slot = EnchantScrollSlot.HeadMid; return true;
            case "headlow":
            case "low": slot = EnchantScrollSlot.HeadLow; return true;
            case "shoes":
            case "footgear": slot = EnchantScrollSlot.Shoes; return true;
            case "accessory":
            case "acc": slot = EnchantScrollSlot.Accessory; return true;
            default: return false;
        }
    }

    /// <summary>
    /// One weighted draw, for the scribe handing a scroll over.
    /// </summary>
    public static EnchantScrollSlot RollSlot()
    {
        var roll = GameRandom.Next(0, WeightTotal);

        for (var i = 0; i < slotWeights.Length; i++)
        {
            roll -= slotWeights[i];
            if (roll < 0)
                return slots[i];
        }

        return EnchantScrollSlot.Weapon;
    }

    /// <summary>
    /// Whether the item itself is the kind of thing this scroll is written for.
    /// </summary>
    /// <remarks>
    /// The same rules the equip code uses to decide what fits where, read off the item data
    /// rather than off what the player is wearing, so every scroll works on a spare sitting
    /// in the bag as well as on the piece being worn.
    /// A headgear that covers two slots answers yes to both of them - it really does occupy
    /// both - and a two-handed weapon is a weapon rather than a shield, because it is in the
    /// weapon table and never reaches the armour branch.
    /// </remarks>
    public static bool FitsSlot(int itemId, EnchantScrollSlot slot)
    {
        if (DataManager.WeaponInfo.ContainsKey(itemId))
            return slot == EnchantScrollSlot.Weapon;

        if (!DataManager.ArmorInfo.TryGetValue(itemId, out var armor))
            return false;

        var isHeadgear = (armor.EquipPosition & EquipPosition.Headgear) != 0;

        return slot switch
        {
            EnchantScrollSlot.Armour => armor.EquipPosition.HasFlag(EquipPosition.Armor),
            EnchantScrollSlot.Shield => armor.EquipPosition.HasFlag(EquipPosition.Shield),
            EnchantScrollSlot.Shoes => armor.EquipPosition.HasFlag(EquipPosition.Footgear),
            EnchantScrollSlot.HeadTop => isHeadgear && armor.HeadPosition.HasFlag(HeadgearPosition.Top),
            EnchantScrollSlot.HeadMid => isHeadgear && armor.HeadPosition.HasFlag(HeadgearPosition.Mid),
            EnchantScrollSlot.HeadLow => isHeadgear && armor.HeadPosition.HasFlag(HeadgearPosition.Bottom),
            EnchantScrollSlot.Accessory => armor.EquipPosition.HasFlag(EquipPosition.Accessory),
            _ => false
        };
    }
}
