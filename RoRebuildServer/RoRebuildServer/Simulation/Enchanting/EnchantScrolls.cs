using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Data.CsvDataTypes;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// The one equipment slot a scroll is written for.
/// </summary>
/// <remarks>
/// Nine, not one. A scroll that worked on anything would make the whole grind a single
/// currency: craft, use on whatever you happen to be holding, done. Naming the slot on the
/// scroll means the thing a player is short of is a particular scroll rather than scrolls
/// in general, which is what makes them worth trading.
///
/// One accessory rather than two. The game has two accessory slots but no left and right
/// accessory: a ring is a ring, it goes in whichever of the two is free, and nothing in the
/// item data or the equip code tells one side from the other. Two scrolls for it would have
/// been two names for the same thing.
///
/// Garment came last. It was left out of the first list and nobody noticed until the
/// scribe had written a few hundred scrolls and not one of them was for a muffler, so it
/// sits at the end of the enum and of every table below rather than in the middle where
/// it belongs alphabetically - the item ids and the stored slot numbers were already given
/// out in this order.
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
    Accessory,
    Garment
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
        EnchantScrollSlot.Accessory,
        EnchantScrollSlot.Garment
    ];

    /// <summary>The tail of the item code for each slot, matching ItemsUsable.csv.</summary>
    private static readonly string[] slotCodes =
        ["Weapon", "Armour", "Shield", "HeadTop", "HeadMid", "HeadLow", "Shoes", "Accessory", "Garment"];

    /// <summary>What to call the slot when talking to the player.</summary>
    private static readonly string[] slotNames =
    [
        "อาวุธ", "ชุดเกราะ", "โล่", "ส่วนหัว Top", "ส่วนหัว Middle", "ส่วนหัว Low",
        "รองเท้า", "เครื่องประดับ", "ผ้าคลุม"
    ];

    /// <summary>
    /// How often the scribe writes each slot, out of a hundred.
    /// </summary>
    /// <remarks>
    /// The crafting recipe is the same whichever scroll comes out, so this is the only place
    /// the scroll a player actually wants is made expensive. The accessory carries both stat
    /// pools and is the strongest thing to enchant, and the two head slots below the top one
    /// are worth having for the same reason a mid headgear is: they are slots most people
    /// leave empty. Those three are a twentieth each. The garment is a tenth: it is a slot
    /// nearly everybody fills, but with one of about four things, so a scroll for it is
    /// worth a little less than one for a slot with real choice in it. The other five split
    /// the rest evenly.
    ///
    /// Adds up to a hundred on purpose, so the numbers here are the percentages in the
    /// dialogue without anybody having to work them out again.
    /// </remarks>
    private static readonly int[] slotWeights = [15, 15, 15, 15, 5, 5, 15, 5, 10];

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
    /// Any scroll of one tier that the player is carrying, whichever slot it names.
    /// </summary>
    /// <remarks>
    /// Walks the nine rather than the bag, because nine lookups is cheaper than a scan
    /// and the answer only has to be "one of these", not "the best of these" - every kind
    /// is worth the same as an ingredient.
    /// </remarks>
    public static bool TryFindHeld(RoRebuildServer.EntityComponents.Player player, EnchantTier tier, out int itemId)
    {
        itemId = 0;

        var inventory = player.Inventory;
        if (inventory == null)
            return false;

        foreach (var slot in slots)
        {
            if (!DataManager.ItemIdByName.TryGetValue(CodeFor(tier, slot), out var id))
                continue;

            if (inventory.GetItemCount(id) <= 0)
                continue;

            itemId = id;
            return true;
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
            case "garment":
            case "robe":
            case "cloak":
            case "muffler": slot = EnchantScrollSlot.Garment; return true;
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
    /// A headgear belongs to one layer and one only - see TopmostLayer - and a two-handed
    /// weapon is a weapon rather than a shield, because it is in the
    /// weapon table and never reaches the armour branch.
    /// </remarks>
    /// <summary>
    /// The one layer a headgear counts as, however many it actually covers.
    /// </summary>
    /// <remarks>
    /// A hat that takes the top and the middle used to answer yes to both scrolls, which
    /// read as a bug from either end: the same hat turned up under two different scrolls,
    /// and a middle scroll bought for a middle-slot hat could be spent on something wearing
    /// the top slot as well.
    ///
    /// Highest layer wins, which is not an arbitrary pick - it is the rule the equip code
    /// already uses to decide which slot to put a hat in, so a scroll now names the same
    /// slot the game itself would name. Nineteen hats cover the top along with something
    /// else and become top-only; twelve cover the middle and the bottom and become middle.
    /// </remarks>
    private static HeadgearPosition TopmostLayer(HeadgearPosition position)
    {
        if (position.HasFlag(HeadgearPosition.Top))
            return HeadgearPosition.Top;
        if (position.HasFlag(HeadgearPosition.Mid))
            return HeadgearPosition.Mid;
        if (position.HasFlag(HeadgearPosition.Bottom))
            return HeadgearPosition.Bottom;

        return HeadgearPosition.None;
    }

    public static bool FitsSlot(int itemId, EnchantScrollSlot slot)
    {
        if (DataManager.WeaponInfo.ContainsKey(itemId))
            return slot == EnchantScrollSlot.Weapon;

        if (!DataManager.ArmorInfo.TryGetValue(itemId, out var armor))
            return false;

        var isHeadgear = (armor.EquipPosition & EquipPosition.Headgear) != 0;
        var head = isHeadgear ? TopmostLayer(armor.HeadPosition) : HeadgearPosition.None;

        return slot switch
        {
            EnchantScrollSlot.Armour => armor.EquipPosition.HasFlag(EquipPosition.Armor),
            EnchantScrollSlot.Shield => armor.EquipPosition.HasFlag(EquipPosition.Shield),
            EnchantScrollSlot.Shoes => armor.EquipPosition.HasFlag(EquipPosition.Footgear),
            EnchantScrollSlot.HeadTop => head == HeadgearPosition.Top,
            EnchantScrollSlot.HeadMid => head == HeadgearPosition.Mid,
            EnchantScrollSlot.HeadLow => head == HeadgearPosition.Bottom,
            EnchantScrollSlot.Accessory => armor.EquipPosition.HasFlag(EquipPosition.Accessory),
            EnchantScrollSlot.Garment => armor.EquipPosition.HasFlag(EquipPosition.Garment),
            _ => false
        };
    }
}
