using Domain.Aggregates;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Config
{
    internal class BusinessEmployeeConfiguration : IEntityTypeConfiguration<BusinessEmployee>
    {
        public void Configure(EntityTypeBuilder<BusinessEmployee> builder)
        {
            builder.HasKey(be => new { be.BusinessId, be.UserId });

            builder.HasOne(be => be.Business)
                   .WithMany(b => b.BusinessEmployees)
                   .HasForeignKey(be => be.BusinessId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(be => be.User)
                   .WithMany(u => u.BusinessEmployees)
                   .HasForeignKey(be => be.UserId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.Property(be => be.Role)
                   .IsRequired()
                   .HasMaxLength(50);

            builder.Property(be => be.RequestedAt)
                   .IsRequired();
        }
    }
}
