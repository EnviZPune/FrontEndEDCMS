using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Aggregates.Reservation;

namespace Infrastructure.Config
{
    public class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
    {
        public void Configure(EntityTypeBuilder<Reservation> builder)
        {
            builder.HasKey(r => r.ReservationId);

            builder.Property(r => r.CreatedAt)
                   .IsRequired();

            builder.Property(r => r.Status)
                   .IsRequired();

            builder.HasOne(r => r.ClothingItem)
                   .WithMany() 
                   .HasForeignKey(r => r.ClothingItemId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(r => r.SimpleUser)
                   .WithMany() 
                   .HasForeignKey(r => r.SimpleUserId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
