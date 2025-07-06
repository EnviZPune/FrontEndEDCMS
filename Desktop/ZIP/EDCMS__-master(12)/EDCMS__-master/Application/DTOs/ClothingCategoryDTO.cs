using System.ComponentModel.DataAnnotations;

namespace Application.DTOs
{
    public class ClothingCategoryDTO
    {
        public int ClothingCategoryId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(7)] // For hex color format like "#FF5733"
        public string? Color { get; set; }

        [MaxLength(100)] // Optional icon name
        public string? Icon { get; set; }

        [Required]
        public int BusinessId { get; set; }
    }
}