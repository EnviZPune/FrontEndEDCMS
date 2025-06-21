using System;
using System.Collections.Generic;

namespace Domain.Aggregates
{
    public enum ChangeType
{
    Create,
    Update,
    Delete,
    UpdatePhotos
}

    public class ProposedChange
    {
        public int ProposedChangeId { get; set; }
        public int BusinessId { get; set; }
        public Business Business { get; set; } = null!;
        public ChangeType Type { get; set; }
        public int? ItemId { get; set; }
        public ClothingItem ClothingItem { get; set; } = null!;
        public string PayloadJson { get; set; } = string.Empty;
        public int RequestedByUserId { get; set; }
        public User RequestedByUser { get; set; } = null!;
        public DateTime RequestedAt { get; set; }
        public bool? IsApproved { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public ICollection<Approval> Approvals { get; set; } = new List<Approval>();
    }
}
