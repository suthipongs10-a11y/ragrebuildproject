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

    /// <summary>
    /// The smith's standing at the moment this was made, not their standing now.
    /// </summary>
    /// <remarks>
    /// A snapshot rather than a lookup, so a weapon is what it was when it was made. The
    /// alternative - reading the smith's rank live - would quietly restat every weapon they
    /// ever sold each time they earned a title, and somebody who bought one for what it
    /// said on the tin would find the tin had changed. It also makes an early piece by a
    /// smith who later became famous a different object from a late one, which is the sort
    /// of thing worth collecting.
    /// </remarks>
    public int ForgerRank { get; set; }

    /// <summary>What this weapon added to that standing. Zero for plain work.</summary>
    public int FamePoints { get; set; }

    public DateTime ForgedAt { get; set; }
}
