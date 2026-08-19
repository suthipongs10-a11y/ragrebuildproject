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

        //Nullable rather than required: every guild that existed before the column did has
        //no title, and a default of "" would mean rewriting all of them on migration.
        [MaxLength(32)] public string? GuildTitle { get; set; }

        //Not nullable: zero already means "no emblem", so a guild from before the column
        //existed reads as having none without anything having to be written to it.
        public int Emblem { get; set; }

        //Everything ever donated. Long rather than int: the score is per item and a guild
        //that runs for a year would be uncomfortably close to two billion on int.
        public long Contribution { get; set; }

        public int SkillPoints { get; set; }

        //The learned levels as "3,5,0,1,2", in the skill enum's order. A string rather than
        //a table: it is five small numbers that are always read and written together, and
        //adding a sixth skill later needs no migration at all.
        [MaxLength(128)] public string? Skills { get; set; }

        public Guid LeaderId { get; set; }
    }
}
