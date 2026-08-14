using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain
{
    //Members are linked by the plain GuildId column on Character rather than a
    //navigation property, which keeps the migration to a create and an add column
    //with no foreign key rebuild. Orphaned ids are cleared when a character loads.
    [Table("Guild")]
    public class DbGuild
    {
        [Key] public int Id { get; set; }
        [MaxLength(64)] public required string GuildName { get; set; }
        public Guid LeaderId { get; set; }
    }
}
