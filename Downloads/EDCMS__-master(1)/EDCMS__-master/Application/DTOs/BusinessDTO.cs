using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Application.DTOs
{
    public class BusinessDTO
    {
        public int BusinessId { get; set; }

        [Required]
        [StringLength(50)]
        public string Name { get; set; }

        [StringLength(100)]
        public string CoverPictureUrl { get; set; }

        [StringLength(100)]
        public string ProfilePictureUrl { get; set; }

        [StringLength(20)]
        public string OpeningHours { get; set; }

        [StringLength(100)]
        public string Location { get; set; }

        [StringLength(50)]
        public string BusinessPhoneNumber { get; set; }

        [StringLength(100)]
        public string Address { get; set; }

        [StringLength(100)]
        public string NIPT { get; set; }

        [StringLength(500)]
        public string Description { get; set; }

        public List<UserDTO> Owners { get; set; } = new List<UserDTO>();

        public List<UserDTO> Employees { get; set; } = new List<UserDTO>();

        public List<ClothingItemDTO> ClothingItems { get; set; } = new List<ClothingItemDTO>();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
