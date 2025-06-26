using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Domain.Aggregates
{
    public class ClothingCategory
    {
        [Key]
        public int ClothingCategoryId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(7)] // For hex color code like "#FFFFFF"
        public string? Color { get; set; }

        [MaxLength(100)] // Optional icon name like "shirt-outline"
        public string? Icon { get; set; }

        [ForeignKey("Business")]
        public int BusinessId { get; set; }

        public Business Business { get; set; } = null!;

        public List<ClothingItem> ClothingItems { get; set; } = new();
    }
}