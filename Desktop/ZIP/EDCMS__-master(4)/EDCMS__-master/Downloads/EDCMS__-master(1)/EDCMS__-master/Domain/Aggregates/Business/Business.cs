using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;

namespace Domain.Aggregates
{
    public class Business
    {
        public int BusinessId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string CoverPictureUrl { get; set; } = string.Empty;
        public string ProfilePictureUrl { get; set; } = string.Empty;
        public string OpeningHours { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string BusinessPhoneNumber { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string NIPT { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public ICollection<ClothingItem> ClothingItems { get; set; } = new List<ClothingItem>();

        public ICollection<BusinessEmployee> BusinessEmployees { get; set; } = new List<BusinessEmployee>();

        [NotMapped]
        public IEnumerable<User> Owners => BusinessEmployees
            .Where(be => be.IsApproved && be.Role == "Owner")
            .Select(be => be.User);

        [NotMapped]
        public IEnumerable<User> Employees => BusinessEmployees
            .Where(be => be.IsApproved && be.Role == "Employee")
            .Select(be => be.User);
    }
}
