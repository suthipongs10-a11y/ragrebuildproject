using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Data.CsvDataTypes;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// The one equipment slot a scroll is written for.
/// </summary>
/// <remarks>
/// Nine, not seven, and not one. A scroll that worked on anything would make the whole
/// grind a single currency: craft, use on whatever you happen to be holding, done. Naming
/// the slot on the scroll means the thing a player is short of is a particular scroll
/// rather than scrolls in general, which is what makes them worth trading.
///
/// The two accessory sides are the odd pair. Nothing in the item data tells a ring apart
/// from another ring - a ring is a ring and it goes in whichever accessory slot is free -
/// so the side has to be read off the player rather than off the item, and that means the
/// accessory has to be worn to be enchanted. Every other slot works on anything in the bag.
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
    AccessoryLeft,
    AccessoryRight
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
        EnchantScrollSlot.AccessoryLeft,
        EnchantScrollSlot.AccessoryRight
    ];

    /// <summary>The tail of the item code for each slot, matching ItemsUsable.csv.</summary>
    private static readonly string[] slotCodes =
        ["Weapon", "Armour", "Shield", "HeadTop", "HeadMid", "HeadLow", "Shoes", "AccLeft", "AccRight"];

    /// <summary>What to call the slot when talking to the player.</summary>
    private static readonly string[] slotNames =
    [
        "อาวุธ", "ชุดเกราะ", "โล่", "ส่วนหัว Top", "ส่วนหัว Middle", "ส่วนหัว Low",
        "รองเท้า", "เครื่องประดับ ซ้าย", "เครื่องประดับ ขวา"
    ];

    /// <summary>
    /// How often the scribe writes each slot, out of a hundred.
    /// </summary>
    /// <remarks>
    /// The crafting recipe is the same whichever scroll comes out, so this is the only place
    /// the scroll a player actually wants is made expensive. Accessories carry both stat
    /// pools and are the strongest thing to enchant, and the two head slots below the top
    /// one are worth having for the same reason a mid headgear is worth having: it is a slot
    /// most people leave empty. Those four are a twentieth each; the other five split the
    /// rest evenly.
    ///
    /// Adds up to a hundred on purpose, so the numbers here are the percentages in the
    /// dialogue without anybody having to work them out again.
    /// </remarks>
    private static readonly int[] slotWeights = [16, 16, 16, 16, 5, 5, 16, 5, 5];

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
            case "accleft":
            case "left": slot = EnchantScrollSlot.AccessoryLeft; return true;
            case "accright":
            case "right": slot = EnchantScrollSlot.AccessoryRight; return true;
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
    /// The equip slot an item has to be worn in, or None if it does not have to be worn.
    /// </summary>
    /// <remarks>
    /// Accessory1 is the left column of the equipment window and Accessory2 the right, which
    /// is the only thing "left" and "right" can mean to somebody looking at the screen.
    /// </remarks>
    public static EquipSlot RequiredEquipSlot(EnchantScrollSlot slot) => slot switch
    {
        EnchantScrollSlot.AccessoryLeft => EquipSlot.Accessory1,
        EnchantScrollSlot.AccessoryRight => EquipSlot.Accessory2,
        _ => EquipSlot.None
    };

    /// <summary>
    /// Whether the item itself is the kind of thing this scroll is written for.
    /// </summary>
    /// <remarks>
    /// The same rules the equip code uses to decide what fits where, read off the item data
    /// rather than off what the player is wearing, so a scroll works on a spare in the bag.
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
            EnchantScrollSlot.AccessoryLeft => armor.EquipPosition.HasFlag(EquipPosition.Accessory),
            EnchantScrollSlot.AccessoryRight => armor.EquipPosition.HasFlag(EquipPosition.Accessory),
            _ => false
        };
    }
}
