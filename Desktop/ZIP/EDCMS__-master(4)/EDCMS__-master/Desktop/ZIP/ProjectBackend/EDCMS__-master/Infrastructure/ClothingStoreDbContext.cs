using Domain.Aggregates;
using Domain.Aggregates.Reservation;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure
{
    public class ClothingStoreDbContext : DbContext
    {
        public ClothingStoreDbContext(DbContextOptions<ClothingStoreDbContext> options)
            : base(options)
        {
        }

        public DbSet<Business> Businesses { get; set; }
        public DbSet<ClothingItem> ClothingItems { get; set; }
        
        public DbSet<ClothingCategory> ClothingCategories { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<ProposedChange> ProposedChanges { get; set; }
        public DbSet<Approval> Approvals { get; set; }
        public DbSet<Reservation> Reservations { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<BusinessEmployee> BusinessEmployees { get; set; }
        public DbSet<EmailVerification> EmailVerifications { get; set; } = null!;
        public DbSet<PasswordResetToken> PasswordResetTokens { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.ApplyConfigurationsFromAssembly(typeof(ClothingStoreDbContext).Assembly);
        }
    }
}
