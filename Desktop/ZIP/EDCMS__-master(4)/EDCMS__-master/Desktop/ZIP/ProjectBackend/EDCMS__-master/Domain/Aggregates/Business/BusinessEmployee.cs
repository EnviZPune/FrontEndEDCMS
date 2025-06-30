using System;

namespace Domain.Aggregates
{
    public class BusinessEmployee
    {
        public int BusinessId { get; set; }
        public Business Business { get; set; } = null!;

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public bool IsApproved { get; set; }
        public DateTime RequestedAt { get; set; }
        public string Role { get; set; } = string.Empty;
    }
}
