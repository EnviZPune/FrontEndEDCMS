using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    public partial class othermigrations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProposedChanges_Users_RequestedByUserId",
                table: "ProposedChanges");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "ClothingItems");

            migrationBuilder.AlterColumn<string>(
                name: "Message",
                table: "Notifications",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<bool>(
                name: "IsRead",
                table: "Notifications",
                type: "boolean",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.AddColumn<int>(
                name: "BusinessId",
                table: "Notifications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDismissed",
                table: "Notifications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ClothingCategoryId",
                table: "ClothingItems",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ClothingCategories",
                columns: table => new
                {
                    ClothingCategoryId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    Icon = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    BusinessId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClothingCategories", x => x.ClothingCategoryId);
                    table.ForeignKey(
                        name: "FK_ClothingCategories_Businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "Businesses",
                        principalColumn: "BusinessId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_BusinessId",
                table: "Notifications",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_ClothingItems_ClothingCategoryId",
                table: "ClothingItems",
                column: "ClothingCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ClothingCategories_BusinessId",
                table: "ClothingCategories",
                column: "BusinessId");

            migrationBuilder.AddForeignKey(
                name: "FK_ClothingItems_ClothingCategories_ClothingCategoryId",
                table: "ClothingItems",
                column: "ClothingCategoryId",
                principalTable: "ClothingCategories",
                principalColumn: "ClothingCategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProposedChanges_Users_RequestedByUserId",
                table: "ProposedChanges",
                column: "RequestedByUserId",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Cascade);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ClothingItems_ClothingCategories_ClothingCategoryId",
                table: "ClothingItems");

            migrationBuilder.DropForeignKey(
                name: "FK_ProposedChanges_Users_RequestedByUserId",
                table: "ProposedChanges");

            migrationBuilder.DropTable(
                name: "ClothingCategories");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_BusinessId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_ClothingItems_ClothingCategoryId",
                table: "ClothingItems");

            migrationBuilder.DropColumn(
                name: "BusinessId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "IsDismissed",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ClothingCategoryId",
                table: "ClothingItems");

            migrationBuilder.AlterColumn<string>(
                name: "Message",
                table: "Notifications",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AlterColumn<bool>(
                name: "IsRead",
                table: "Notifications",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "ClothingItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddForeignKey(
                name: "FK_ProposedChanges_Users_RequestedByUserId",
                table: "ProposedChanges",
                column: "RequestedByUserId",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
