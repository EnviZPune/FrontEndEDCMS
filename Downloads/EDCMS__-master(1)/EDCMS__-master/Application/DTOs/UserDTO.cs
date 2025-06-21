using System;
using System.Collections.Generic;

namespace Application.DTOs
{
    public class UserDTO
    {
        public int UserId { get; set; }

        public string Name { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public string? Password { get; set; }

        public UserRoleDTO Role { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        public string? ProfilePictureUrl { get; set; }

        public string? TelephoneNumber { get; set; }

        public List<BusinessDTO> Businesses { get; set; } = new();
    }

    public enum UserRoleDTO
    {
        Owner,
        Employee,
        User
    }
}
