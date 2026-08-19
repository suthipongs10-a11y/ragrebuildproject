using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Adds the guild's emblem, which is a number into a list of pictures the client
    /// holds. Defaults to zero, which already means "no emblem", so every guild that
    /// existed before this column reads correctly without being rewritten.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260819180000_AddGuildEmblem")]
    public partial class AddGuildEmblem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Emblem",
                table: "Guild",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Emblem",
                table: "Guild");
        }
    }
}
