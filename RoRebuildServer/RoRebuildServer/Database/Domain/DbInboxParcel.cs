using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// One thing waiting to be collected: an item, some money, or both.
///
/// A row each rather than one blob per character, because two auctions can end in the
/// same second and a blob would mean reading it, adding to it and writing it back - with
/// the second write quietly throwing away the first. Rows only ever get inserted, so
/// there is nothing to race over.
///
/// The recipient is a character rather than an account: what was bid for is bid for by
/// somebody, and a parcel that lands on a different character than the one who earned it
/// is a bug report nobody can make sense of.
/// </summary>
[Table("InboxParcel")]
public class DbInboxParcel : IDbMarketItem
{
    [Key] public int Id { get; set; }

    public Guid CharacterId { get; set; }

    /// <summary>A <see cref="RebuildSharedData.Enum.ParcelReason"/>. The window turns it
    /// into a sentence, so the wording can change without touching the database.</summary>
    public byte Reason { get; set; }

    /// <summary>Who this came from, for the window to show. Blank when nobody did.</summary>
    [MaxLength(40)] public string? FromName { get; set; }

    /// <summary>Zeny in the parcel. Zero for an item-only one.</summary>
    public int Zeny { get; set; }

    /// <summary>Zero when the parcel is money only.</summary>
    public int ItemId { get; set; }

    public int ItemCount { get; set; }
    public bool IsUnique { get; set; }
    public byte Refine { get; set; }
    public byte ItemFlags { get; set; }
    public Guid UniqueId { get; set; }
    public int Slot0 { get; set; }
    public int Slot1 { get; set; }
    public int Slot2 { get; set; }
    public int Slot3 { get; set; }

    /// <summary>When it arrived, which is also the order the window shows them in.</summary>
    public DateTime SentAt { get; set; }
}
