using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Aggregates;

namespace Infrastructure.Config
{
    public class ApprovalConfiguration : IEntityTypeConfiguration<Approval>
    {
        public void Configure(EntityTypeBuilder<Approval> builder)
        {
            builder.HasKey(a => a.ApprovalId);

            builder.HasOne(a => a.ProposedChange)
                   .WithMany(pc => pc.Approvals)
                   .HasForeignKey(a => a.ProposedChangeId)
                   .IsRequired();

            builder.HasOne(a => a.BusinessOwner)
                   .WithMany()
                   .HasForeignKey(a => a.OwnerId)
                   .IsRequired();

            builder.Property(a => a.Approved).IsRequired();
            builder.Property(a => a.CreatedAt).IsRequired();
            builder.Property(a => a.UpdatedAt).IsRequired();
        }
    }
}
