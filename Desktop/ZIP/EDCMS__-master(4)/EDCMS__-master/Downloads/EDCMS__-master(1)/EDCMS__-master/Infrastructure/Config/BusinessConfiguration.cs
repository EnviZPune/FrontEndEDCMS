using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Aggregates;

namespace Infrastructure.Config
{
    public class BusinessConfiguration : IEntityTypeConfiguration<Business>
    {
        public void Configure(EntityTypeBuilder<Business> builder)
        {
            builder.HasKey(b => b.BusinessId);

            builder.Property(b => b.Name)
                   .IsRequired()
                   .HasMaxLength(50);
            builder.Property(b => b.CoverPictureUrl)
                   .IsRequired()
                   .HasMaxLength(100);
            builder.Property(b => b.ProfilePictureUrl)
                   .IsRequired()
                   .HasMaxLength(100);
            builder.Property(b => b.OpeningHours)
                   .IsRequired()
                   .HasMaxLength(20);
            builder.Property(b => b.Location)
                   .IsRequired()
                   .HasMaxLength(100);
            builder.Property(b => b.BusinessPhoneNumber)
                   .IsRequired()
                   .HasMaxLength(50);
            builder.Property(b => b.Address)
                   .IsRequired()
                   .HasMaxLength(100);
            builder.Property(b => b.NIPT)
                   .IsRequired()
                   .HasMaxLength(100);
            builder.Property(b => b.Description)
                   .IsRequired()
                   .HasMaxLength(500);
            builder.Property(b => b.CreatedAt).IsRequired();
            builder.Property(b => b.UpdatedAt).IsRequired();

            builder.HasMany(b => b.BusinessEmployees)
                   .WithOne(be => be.Business)
                   .HasForeignKey(be => be.BusinessId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
