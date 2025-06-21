// Application/Services/UserService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTOs;
using Domain.Aggregates;
using Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Application.Services
{
    public class UserService
    {
        private readonly ClothingStoreDbContext _context;

        public UserService(ClothingStoreDbContext context)
        {
            _context = context;
        }

        public async Task<List<UserDTO>> GetAllAsync()
        {
            // 1) fetch entities into memory
            var users = await _context.Users
                .AsNoTracking()
                .ToListAsync();

            // 2) project with TryParse safely
            return users.Select(user =>
            {
                var parsedRole = Enum.TryParse<UserRoleDTO>(user.Role, true, out var r)
                    ? r
                    : UserRoleDTO.User;

                return new UserDTO
                {
                    UserId            = user.UserId,
                    Name              = user.Name,
                    Email             = user.Email,
                    Role              = parsedRole,
                    CreatedAt         = user.CreatedAt,
                    ProfilePictureUrl = user.ProfilePictureUrl,
                    TelephoneNumber   = user.TelephoneNumber,
                    Businesses        = new List<BusinessDTO>()
                };
            }).ToList();
        }

        public async Task<UserDTO?> GetByIdAsync(int id)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == id);

            if (user == null)
                return null;

            var parsedRole = Enum.TryParse<UserRoleDTO>(user.Role, true, out var r)
                ? r
                : UserRoleDTO.User;

            var dto = new UserDTO
            {
                UserId            = user.UserId,
                Name              = user.Name,
                Email             = user.Email,
                Role              = parsedRole,
                CreatedAt         = user.CreatedAt,
                ProfilePictureUrl = user.ProfilePictureUrl,
                TelephoneNumber   = user.TelephoneNumber,
                Businesses        = new List<BusinessDTO>()
            };

            if (user.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase))
            {
                var ownedLinks = await _context.BusinessEmployees
                    .Include(be => be.Business)
                    .Where(be =>
                        be.UserId   == id &&
                        be.Role     == "Owner" &&
                        be.IsApproved)
                    .ToListAsync();

                foreach (var link in ownedLinks)
                {
                    var b = link.Business;

                    var ownerLinks = await _context.BusinessEmployees
                        .Include(be2 => be2.User)
                        .Where(be2 =>
                            be2.BusinessId == b.BusinessId &&
                            be2.Role       == "Owner" &&
                            be2.IsApproved)
                        .ToListAsync();

                    var owners = ownerLinks
                        .Select(be2 =>
                        {
                            var orole = Enum.TryParse<UserRoleDTO>(be2.User.Role, true, out var rr)
                                        ? rr
                                        : UserRoleDTO.User;
                            return new UserDTO
                            {
                                UserId            = be2.User.UserId,
                                Name              = be2.User.Name,
                                Email             = be2.User.Email,
                                Role              = orole,
                                CreatedAt         = be2.User.CreatedAt,
                                ProfilePictureUrl = be2.User.ProfilePictureUrl,
                                TelephoneNumber   = be2.User.TelephoneNumber
                            };
                        })
                        .ToList();

                    dto.Businesses.Add(new BusinessDTO
                    {
                        BusinessId          = b.BusinessId,
                        CoverPictureUrl     = b.CoverPictureUrl,
                        ProfilePictureUrl   = b.ProfilePictureUrl,
                        OpeningHours        = b.OpeningHours,
                        Location            = b.Location,
                        BusinessPhoneNumber = b.BusinessPhoneNumber,
                        Address             = b.Address,
                        NIPT                = b.NIPT,
                        Description         = b.Description,
                        CreatedAt           = b.CreatedAt,
                        UpdatedAt           = b.UpdatedAt,
                        Owners              = owners
                    });
                }
            }

            return dto;
        }

        public async Task<UserDTO?> GetByEmailAsync(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return null;

            var normalized = email.Trim().ToLower();

            var userId = await _context.Users
                .AsNoTracking()
                .Where(u => u.Email.ToLower() == normalized)
                .Select(u => u.UserId)
                .FirstOrDefaultAsync();

            return userId == 0
                ? null
                : await GetByIdAsync(userId);
        }

        public async Task CreateAsync(UserDTO dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Password))
                throw new ArgumentException("Password cannot be empty.", nameof(dto.Password));

            var user = new User
            {
                Name              = dto.Name,
                Email             = dto.Email,
                PasswordHash      = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                TelephoneNumber   = dto.TelephoneNumber,
                ProfilePictureUrl = dto.ProfilePictureUrl ?? string.Empty,
                Role              = dto.Role.ToString(),
                CreatedAt         = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            dto.UserId    = user.UserId;
            dto.CreatedAt = user.CreatedAt;
        }

        public async Task UpdateAsync(int id, UserDTO dto)
        {
            var user = await _context.Users.FindAsync(id)
                       ?? throw new KeyNotFoundException($"User {id} not found.");

            user.Name              = dto.Name;
            user.Email             = dto.Email;
            user.TelephoneNumber   = dto.TelephoneNumber;
            user.ProfilePictureUrl = dto.ProfilePictureUrl;
            user.Role              = dto.Role.ToString();

            if (!string.IsNullOrWhiteSpace(dto.Password))
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var user = await _context.Users.FindAsync(id)
                       ?? throw new KeyNotFoundException($"User {id} not found.");

            // Remove related BusinessEmployee links
            var links = _context.BusinessEmployees.Where(be => be.UserId == id);
            _context.BusinessEmployees.RemoveRange(links);

            // Remove related ProposedChanges
            var changes = _context.ProposedChanges.Where(pc => pc.RequestedByUserId == id);
            _context.ProposedChanges.RemoveRange(changes);

            // Remove related Notifications
            var notes = _context.Notifications.Where(n => n.UserId == id);
            _context.Notifications.RemoveRange(notes);

            _context.Users.Remove(user);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Delete Error] {ex}");
                throw;
            }
        }
    }
}
