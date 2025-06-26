using System;

namespace Domain.Aggregates
{
    public class Approval
    {
        public int ApprovalId { get; set; }  
        public int ProposedChangeId { get; set; } 
        public int OwnerId { get; set; }  
        public bool Approved { get; set; } 
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;  
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;  
        public User BusinessOwner { get; set; } = null!;
        public ProposedChange ProposedChange { get; set; } = null!;
    }
}
