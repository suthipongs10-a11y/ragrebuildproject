using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Moves the title from the guild to the character, so a member writes their own
    /// rather than waiting for the leader to write one for all forty of them.
    ///
    /// The guild's own column is left where it is. Dropping a column in SQLite means
    /// rebuilding the table, and an unread column costs nothing; this only stops anything
    /// writing to it. Nullable for the same reason as the guild's was: characters that
    /// existed before this have no title, and no title and an empty one are the same
    /// thing to everything that reads it.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260820210000_AddCharacterGuildTitle")]
    public partial class AddCharacterGuildTitle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GuildTitle",
                table: "Character",
                type: "TEXT",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GuildTitle",
                table: "Character");
        }
    }
}
