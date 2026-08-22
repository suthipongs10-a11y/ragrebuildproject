using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// Who forged a weapon, kept against the weapon rather than against the character.
///
/// The item's own guid is the key, which it already has and which follows it everywhere -
/// into a trade, into the market, onto the ground. There was nowhere to put this in the
/// item itself: a UniqueItem is a fixed forty bytes and its four spare slots are the card
/// slots, which a forged weapon fills with star crumbs and a stone.
///
/// The name is a copy taken at the moment of forging rather than a link to the character.
/// A weapon outlives the smith who made it - they may rename, they may delete - and what
/// the weapon should say is who made it, not who that person is now.
/// </summary>
[Table("ForgedItem")]
public class DbForgedItem
{
    /// <summary>The item's own guid, which is what the weapon carries around.</summary>
    [Key] public Guid UniqueId { get; set; }

    /// <summary>Kept for later - a smith's own list of what they have made, one day.</summary>
    public Guid ForgerId { get; set; }

    [MaxLength(40)] public string ForgerName { get; set; } = "";

    public DateTime ForgedAt { get; set; }
}
