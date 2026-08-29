using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// The options rolled onto a piece of equipment, kept against the item rather than the
/// character who is wearing it today.
///
/// The item's own guid is the key, the same trick DbForgedItem uses and for the same
/// reason: a UniqueItem is a fixed forty bytes and its four spare slots are the card
/// slots. The guid follows the item into a trade, into the market and onto the ground,
/// so the options follow it too.
/// </summary>
/// <remarks>
/// Three fixed pairs rather than a child table. Three is the ceiling and always will be
/// unless a scroll above legendary is invented, and a row per option would mean a join
/// on every read of a table that is read whole exactly once.
///
/// The stat is stored as its name and not as its number. CharacterStat has nearly four
/// hundred members and this repository tracks an upstream that adds to it - the day
/// somebody inserts a stat in the middle of that enum, every stored number would quietly
/// come to mean a different stat. A name cannot rot that way, and it can be read by a
/// person looking at the table with a database browser.
/// </remarks>
[Table("EnchantedItem")]
public class DbEnchantedItem
{
    /// <summary>The item's own guid, which is what the equipment carries around.</summary>
    [Key] public Guid UniqueId { get; set; }

    /// <summary>Which scroll rolled these, kept for the colour the client draws them in.</summary>
    public byte Tier { get; set; }

    [MaxLength(40)] public string Stat1 { get; set; } = "";
    public int Value1 { get; set; }

    [MaxLength(40)] public string Stat2 { get; set; } = "";
    public int Value2 { get; set; }

    [MaxLength(40)] public string Stat3 { get; set; } = "";
    public int Value3 { get; set; }

    public DateTime EnchantedAt { get; set; }
}
