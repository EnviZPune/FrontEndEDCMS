
using System;
using System.ComponentModel.DataAnnotations;

namespace Application.DTOs
{
    public class ApprovalDTO
    {
        public int ApprovalId { get; set; }

        [Required]
        public int ProposedChangeId { get; set; }

        [Required]
        public int OwnerId { get; set; }

        [Required]
        public bool Approved { get; set; }  
        public DateTime CreatedAt { get; set; }  
    }
}
