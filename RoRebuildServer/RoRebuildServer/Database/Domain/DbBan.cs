using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// One person told to go away, and until when.
/// </summary>
/// <remarks>
/// One table for both kinds. An account ban has an AccountId and no Address; an address ban
/// has an Address and no AccountId; banning somebody and the line they came in on writes two
/// rows. Two tables would have meant two loaders, two lookups and two of every command, for
/// a difference of one column.
///
/// The reason and the name of whoever gave it are kept because a ban outlives the argument
/// that caused it. Six weeks later the only thing anybody remembers is that somebody was
/// banned, and a list with no reasons on it is a list nobody dares lift anything from.
///
/// Identity's own LockoutEnd was the other candidate and does not fit: it carries a date and
/// nothing else, and it is the same field the framework uses for too many wrong passwords, so
/// a ban and a locked-out typist would have been indistinguishable.
/// </remarks>
[Table("Ban")]
public class DbBan
{
    [Key] public int Id { get; set; }

    /// <summary>The account, or zero when this row bans an address and not an account.</summary>
    public int AccountId { get; set; }

    /// <summary>The address, or empty when this row bans an account and not an address.</summary>
    [MaxLength(64)] public string Address { get; set; } = "";

    /// <summary>Kept for the ban list to read: an id alone tells a reader nothing.</summary>
    [MaxLength(64)] public string AccountName { get; set; } = "";

    [MaxLength(200)] public string Reason { get; set; } = "";

    [MaxLength(64)] public string BannedBy { get; set; } = "";

    public DateTime BannedAt { get; set; }

    /// <summary>When it lifts. A permanent ban is stored as DateTime.MaxValue.</summary>
    public DateTime ExpiresAt { get; set; }
}
