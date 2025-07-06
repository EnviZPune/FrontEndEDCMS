using Domain.Aggregates;  

namespace Application.DTOs
{
    public class ClothingItemFilter
    {
        public string? Name         { get; set; }
        public string? Description  { get; set; }
        public decimal? PriceMin    { get; set; }
        public decimal? PriceMax    { get; set; }
        public int? QuantityMin     { get; set; }
        public int? QuantityMax     { get; set; }
        public string? Category     { get; set; }
        public string? Brand        { get; set; }
        public string? Model        { get; set; }
        public string? Colors       { get; set; }
        public ClothingSize? Size   { get; set; }
        public string? Material     { get; set; }
    }
}