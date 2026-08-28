using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// Which account came in from which address, and when it last did.
/// </summary>
/// <remarks>
/// This is the table that makes a bot farm visible. One account behaving oddly is a guess;
/// eleven accounts that have only ever logged in from one address is not, and that question
/// cannot be asked at all unless somebody wrote the addresses down as they arrived.
///
/// A row per pair rather than a row per login. What is worth keeping is "these two have been
/// seen together", and a log of every login would be thousands of rows a week to answer the
/// same question more slowly.
/// </remarks>
[Table("AccountAddress")]
public class DbAccountAddress
{
    [Key] public int Id { get; set; }

    public int AccountId { get; set; }

    [MaxLength(64)] public string AccountName { get; set; } = "";

    [MaxLength(64)] public string Address { get; set; } = "";

    public DateTime FirstSeen { get; set; }

    public DateTime LastSeen { get; set; }

    public int LoginCount { get; set; }
}
