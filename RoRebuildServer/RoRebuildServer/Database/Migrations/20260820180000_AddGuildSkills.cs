using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Adds the guild's learned skills, written as their levels in enum order. Nullable,
    /// which reads the same as every skill being at zero - what every existing guild is.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260820180000_AddGuildSkills")]
    public partial class AddGuildSkills : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Skills",
                table: "Guild",
                type: "TEXT",
                maxLength: 128,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Skills", table: "Guild");
        }
    }
}
