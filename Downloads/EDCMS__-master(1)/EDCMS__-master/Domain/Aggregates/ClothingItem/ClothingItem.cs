using System;
using System.Collections.Generic;

namespace Domain.Aggregates
{
    public enum ClothingSize
    {
        XS,
        S,
        M,
        L,
        XL,
        XXL
    }

    public class ClothingItem
    {
        public int ClothingItemId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Quantity { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Brand { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string PictureUrls { get; set; } = string.Empty;
        public string Colors { get; set; } = string.Empty;
        public ClothingSize Sizes { get; set; }
        public string Material { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public ICollection<ProposedChange> ProposedChanges { get; set; } = new List<ProposedChange>();
        public ICollection<Business> Businesses { get; set; } = new List<Business>();
    }
}
