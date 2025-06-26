using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Aggregates;
using System.Collections.Generic;

namespace Infrastructure.Config
{
    public class ClothingItemConfiguration : IEntityTypeConfiguration<ClothingItem>
    {
        public void Configure(EntityTypeBuilder<ClothingItem> builder)
        {
            builder.HasKey(c => c.ClothingItemId);

            builder
                .HasMany(c => c.Businesses)
                .WithMany(b => b.ClothingItems)
                .UsingEntity<Dictionary<string, object>>(
                    "BusinessClothingItems",
                    j => j.HasOne<Business>()
                          .WithMany()
                          .HasForeignKey("BusinessId")
                          .OnDelete(DeleteBehavior.Cascade),
                    j => j.HasOne<ClothingItem>()
                          .WithMany()
                          .HasForeignKey("ClothingItemId")
                          .OnDelete(DeleteBehavior.Cascade),
                    j =>
                    {
                        j.HasKey("ClothingItemId", "BusinessId");
                        j.ToTable("BusinessClothingItems");
                    });
        }
    }
}
