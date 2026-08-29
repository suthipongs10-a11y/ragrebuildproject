using RebuildSharedData.Enum.EntityStats;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// How strong a scroll is. The tier decides how many options it rolls, how large they
/// are, and which stats it is allowed to draw from.
/// </summary>
/// <remarks>
/// Stored as a number in the database and shown to the player as a colour, so the order
/// matters and nothing may be inserted in the middle of it.
/// </remarks>
public enum EnchantTier : byte
{
    None = 0,
    Earth = 1,  //ดิน
    Sky = 2,    //ฟ้า
    Heaven = 3, //สวรรค์
    Legend = 4  //ตำนาน
}

/// <summary>One rolled option: a stat and how much of it the item grants.</summary>
public struct EnchantOption
{
    public CharacterStat Stat;
    public int Value;

    public EnchantOption(CharacterStat stat, int value)
    {
        Stat = stat;
        Value = value;
    }

    public bool IsEmpty => Value == 0;
}

/// <summary>
/// The options rolled onto one piece of equipment.
/// </summary>
/// <remarks>
/// Three is the ceiling because the legendary scroll rolls three and nothing rolls more.
/// It is a fixed array rather than a list so that one enchanted item is one allocation:
/// there can be one of these per item anybody has ever enchanted, all held for the life
/// of the server.
///
/// A scroll replaces the whole block rather than filling the next empty slot. That is the
/// design, not a shortcut - it means there is no "which slot" question to answer in the
/// interface, and it is what makes using a weaker scroll on a good item a real decision
/// rather than a free extra roll.
/// </remarks>
public class ItemEnchant
{
    public const int MaxOptions = 3;

    public EnchantTier Tier;
    public readonly EnchantOption[] Options = new EnchantOption[MaxOptions];

    /// <summary>How many of the three slots are filled. Always the first N.</summary>
    public int Count;

    public ItemEnchant(EnchantTier tier)
    {
        Tier = tier;
    }

    /// <summary>Appends an option, or does nothing if the block is already full.</summary>
    public bool Add(CharacterStat stat, int value)
    {
        if (Count >= MaxOptions || value == 0)
            return false;

        Options[Count] = new EnchantOption(stat, value);
        Count++;
        return true;
    }

    /// <summary>
    /// Whether this stat is already on the item.
    /// </summary>
    /// <remarks>
    /// The roller uses this to keep one item from coming out with the same stat twice.
    /// Two options that both say Str would read as one line to a player and would let a
    /// single piece of equipment carry double what any other can.
    /// </remarks>
    public bool HasStat(CharacterStat stat)
    {
        for (var i = 0; i < Count; i++)
            if (Options[i].Stat == stat)
                return true;

        return false;
    }
}
