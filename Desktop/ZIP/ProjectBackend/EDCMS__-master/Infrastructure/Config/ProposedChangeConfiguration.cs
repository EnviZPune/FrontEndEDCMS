using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Aggregates;

namespace Infrastructure.Config
{
    public class ProposedChangeConfiguration : IEntityTypeConfiguration<ProposedChange>
    {
        public void Configure(EntityTypeBuilder<ProposedChange> builder)
        {
            builder.HasKey(pc => pc.ProposedChangeId);

            builder.Property(pc => pc.BusinessId).IsRequired();
            builder.Property(pc => pc.Type).IsRequired();
            builder.Property(pc => pc.PayloadJson).IsRequired();
            builder.Property(pc => pc.RequestedByUserId).IsRequired();
            builder.Property(pc => pc.RequestedAt).IsRequired();
            builder.Property(pc => pc.IsApproved).IsRequired(false);
            builder.Property(pc => pc.ResolvedAt).IsRequired(false);

            builder.HasOne(pc => pc.Business)
                   .WithMany()
                   .HasForeignKey(pc => pc.BusinessId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(pc => pc.RequestedByUser)
                   .WithMany(u => u.ProposedChanges)
                   .HasForeignKey(pc => pc.RequestedByUserId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(pc => pc.ClothingItem)
                   .WithMany(ci => ci.ProposedChanges)
                   .HasForeignKey(pc => pc.ItemId)
                   .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
