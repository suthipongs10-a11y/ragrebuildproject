using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// One name somebody has chosen to remember.
/// </summary>
/// <remarks>
/// One sided on purpose. Remembering somebody is not a request they have to answer, so
/// there is no pending state to keep and nobody can be stopped from being on a list they
/// never asked to be on - which is the same bargain as writing a name down on paper. Two
/// people who both add each other simply have two rows.
///
/// The name is stored beside the id rather than looked up through it. A list has to show
/// something for a character who has not been seen since the server started, and reading
/// forty names out of the character table every time somebody opens a window is forty
/// queries for a line of text that has not changed since yesterday. The id is the truth
/// and the name is a copy that gets refreshed whenever that character is seen.
/// </remarks>
[Table("Friend")]
public class DbFriend
{
    /// <summary>Small and sequential, because it is what the client points at to remove one.</summary>
    [Key] public int Id { get; set; }

    /// <summary>Whose list this row belongs to.</summary>
    public Guid OwnerId { get; set; }

    public Guid FriendId { get; set; }

    [MaxLength(40)] public string FriendName { get; set; } = "";

    public DateTime AddedAt { get; set; }
}
