using System;
using System.ComponentModel.DataAnnotations;

namespace Application.DTOs
{
    public class ProposedChangeDTO
    {
        public int ProposedChangeId { get; set; }

        [Required]
        public int ClothingItemId { get; set; }

        [Required]
        public int EmployeeId { get; set; }

        [Required]
        public string ChangeDetails { get; set; }

        [Required]
        public string OperationType { get; set; }  

        [Required]
        public int BusinessId { get; set; } 

        [Required]
        public ProposedChangeStatusDTO Status { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? ReviewedAt { get; set; }
    }

    public enum ProposedChangeStatusDTO
    {
        Pending,    
        Approved,   
        Rejected    
    }
}
