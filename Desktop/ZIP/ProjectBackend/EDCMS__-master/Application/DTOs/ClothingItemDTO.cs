using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Application.DTOs
{
    public enum ClothingSize
    {
        XS, S, M, L, XL, XXL
    }

    public class ClothingItemDTO
    {
        public int ClothingItemId { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "At least one BusinessId must be provided.")]
        [MinLength(1, ErrorMessage = "At least one BusinessId must be provided.")]
        public List<int> BusinessIds { get; set; } = new List<int>();

        [StringLength(500)]
        public string Description { get; set; } = string.Empty;

        [Range(0, double.MaxValue)]
        public decimal Price { get; set; }

        [Range(0, int.MaxValue)]
        public int Quantity { get; set; }

        // these two come from your DB join
        public int?    ClothingCategoryId   { get; set; }
        public string? ClothingCategoryName { get; set; }

        // ← NEW: this lets EF translate ".Category" when you group by "Category"
        public string Category => ClothingCategoryName ?? string.Empty;

        [StringLength(100)]
        public string Brand { get; set; } = string.Empty;

        [StringLength(100)]
        public string Model { get; set; } = string.Empty;

        public List<string> PictureUrls { get; set; } = new List<string>();
        public List<string> Colors      { get; set; } = new List<string>();
        public ClothingSize   Sizes      { get; set; }
        
        [StringLength(50)]
        public string Material { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}