using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;

namespace Domain.Aggregates
{
    public class User
    {
        public string ProfilePictureUrl { get; set; } = string.Empty;
        public string TelephoneNumber { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool EmailConfirmed { get; set; } = false;

        public string? EmailConfirmationToken { get; set; }
        public DateTime? EmailConfirmationSentAt { get; set; }
        public string? PasswordResetToken { get; set; }
        public DateTime? PasswordResetSentAt { get; set; }

        public ICollection<BusinessEmployee> BusinessEmployees { get; set; } = new List<BusinessEmployee>();
        public ICollection<ProposedChange> ProposedChanges { get; set; } = new List<ProposedChange>();
        public ICollection<Notification> Notifications { get; set; } = new List<Notification>();

        [NotMapped]
        public IEnumerable<Business> OwnedBusinesses => BusinessEmployees
            .Where(be => be.Role == "Owner" && be.IsApproved)
            .Select(be => be.Business);

        [NotMapped]
        public IEnumerable<Business> EmployeeBusinesses => BusinessEmployees
            .Where(be => be.Role == "Employee" && be.IsApproved)
            .Select(be => be.Business);
    }
}
