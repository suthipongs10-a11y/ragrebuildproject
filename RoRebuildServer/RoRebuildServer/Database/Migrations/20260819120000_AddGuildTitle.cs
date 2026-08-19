using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Adds the guild's title, which its leader sets and every member wears after the
    /// guild name on their name plate.
    ///
    /// Nullable, so guilds that existed before this do not have to be rewritten: no title
    /// and an empty title are the same thing to everything that reads it.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260819120000_AddGuildTitle")]
    public partial class AddGuildTitle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GuildTitle",
                table: "Guild",
                type: "TEXT",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GuildTitle",
                table: "Guild");
        }
    }
}
