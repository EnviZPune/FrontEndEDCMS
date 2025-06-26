using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTOs;
using Application.DTOs.Pagination;
using Domain.Aggregates;
using Infrastructure;
using Infrastructure.utils.PaginationWrapper;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using ClothingSize = Domain.Aggregates.ClothingSize;
using Infrastructure.Extensions;

namespace Application.Services
{
    public class BusinessService
    {
        private readonly ClothingStoreDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public BusinessService(ClothingStoreDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("UserId")?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                throw new UnauthorizedAccessException("User is not authenticated.");
            return int.Parse(userIdClaim);
        }

        public List<BusinessDTO> ViewAllBusinesses()
        {
            var userRoleType = typeof(UserRoleDTO);

            return _context.Businesses.Select(b => new BusinessDTO
            {
                BusinessId = b.BusinessId,
                Name = b.Name,
                Description = b.Description,
                CoverPictureUrl = b.CoverPictureUrl,
                ProfilePictureUrl = b.ProfilePictureUrl,
                OpeningHours = b.OpeningHours,
                Location = b.Location,
                BusinessPhoneNumber = b.BusinessPhoneNumber,
                Address = b.Address,
                NIPT = b.NIPT,
                Owners = b.Owners.Select(o => new UserDTO
                {
                    UserId = o.UserId,
                    Name = o.Name,
                    Email = o.Email,
                    Role = (UserRoleDTO)Enum.Parse(userRoleType, o.Role, true),
                    CreatedAt = o.CreatedAt
                }).ToList(),
                Employees = b.Employees.Select(e => new UserDTO
                {
                    UserId = e.UserId,
                    Name = e.Name,
                    Email = e.Email,
                    Role = (UserRoleDTO)Enum.Parse(userRoleType, e.Role, true),
                    CreatedAt = e.CreatedAt
                }).ToList(),
                ClothingItems = b.ClothingItems.Select(ci => new ClothingItemDTO
                {
                    ClothingItemId = ci.ClothingItemId,
                    BusinessIds = ci.Businesses.Select(biz => biz.BusinessId).ToList(),
                    Description = ci.Description,
                    Price = ci.Price,
                    Quantity = ci.Quantity,
                    ClothingCategoryId  = ci.ClothingCategoryId ,
                    Brand = ci.Brand,
                    Model = ci.Model,
                    PictureUrls = JsonConvert.DeserializeObject<List<string>>(ci.PictureUrls),
                    Colors = JsonConvert.DeserializeObject<List<string>>(ci.Colors),
                    Sizes = (Application.DTOs.ClothingSize)ci.Sizes,
                    Material = ci.Material,
                    CreatedAt = ci.CreatedAt,
                    UpdatedAt = ci.UpdatedAt
                }).ToList(),
                CreatedAt = b.CreatedAt,
                UpdatedAt = b.UpdatedAt
            }).ToList();
        }

        public IEnumerable<BusinessDTO> GetAllByOwner()
        {
            int userId = GetCurrentUserId();
            var userRoleType = typeof(UserRoleDTO);

            return _context.Businesses
                .Where(b => b.Owners.Any(o => o.UserId == userId))
                .Select(b => new BusinessDTO
                {
                    BusinessId = b.BusinessId,
                    Name = b.Name,
                    Description = b.Description,
                    CoverPictureUrl = b.CoverPictureUrl,
                    ProfilePictureUrl = b.ProfilePictureUrl,
                    OpeningHours = b.OpeningHours,
                    Location = b.Location,
                    BusinessPhoneNumber = b.BusinessPhoneNumber,
                    Address = b.Address,
                    NIPT = b.NIPT,
                    Owners = b.Owners.Select(o => new UserDTO
                    {
                        UserId = o.UserId,
                        Name = o.Name,
                        Email = o.Email,
                        Role = (UserRoleDTO)Enum.Parse(userRoleType, o.Role, true),
                        CreatedAt = o.CreatedAt
                    }).ToList(),
                    Employees = b.Employees.Select(e => new UserDTO
                    {
                        UserId = e.UserId,
                        Name = e.Name,
                        Email = e.Email,
                        Role = (UserRoleDTO)Enum.Parse(userRoleType, e.Role, true),
                        CreatedAt = e.CreatedAt
                    }).ToList(),
                    ClothingItems = b.ClothingItems.Select(ci => new ClothingItemDTO
                    {
                        ClothingItemId = ci.ClothingItemId,
                        BusinessIds = ci.Businesses.Select(biz => biz.BusinessId).ToList(),
                        Description = ci.Description,
                        Price = ci.Price,
                        Quantity = ci.Quantity,
                        ClothingCategoryId  = ci.ClothingCategoryId ,
                        Brand = ci.Brand,
                        Model = ci.Model,
                        PictureUrls = JsonConvert.DeserializeObject<List<string>>(ci.PictureUrls),
                        Colors = JsonConvert.DeserializeObject<List<string>>(ci.Colors),
                        Sizes = (Application.DTOs.ClothingSize)ci.Sizes,
                        Material = ci.Material,
                        CreatedAt = ci.CreatedAt,
                        UpdatedAt = ci.UpdatedAt
                    }).ToList(),
                    CreatedAt = b.CreatedAt,
                    UpdatedAt = b.UpdatedAt
                }).ToList();
        }

        public BusinessDTO GetById(int id)
        {
            int userId = GetCurrentUserId();

            var business = _context.Businesses
                .Include(b => b.BusinessEmployees)
                .SingleOrDefault(b =>
                    b.BusinessId == id &&
                    b.BusinessEmployees.Any(be =>
                        be.UserId == userId &&
                        be.Role == "Owner" &&
                        be.IsApproved));

            if (business == null)
                return null;

            return new BusinessDTO
            {
                BusinessId = business.BusinessId,
                Name = business.Name,
                Description = business.Description,
                CoverPictureUrl = business.CoverPictureUrl,
                ProfilePictureUrl = business.ProfilePictureUrl,
                OpeningHours = business.OpeningHours,
                Location = business.Location,
                BusinessPhoneNumber = business.BusinessPhoneNumber,
                Address = business.Address,
                NIPT = business.NIPT,
                Owners = business.BusinessEmployees
                    .Where(be => be.Role == "Owner" && be.IsApproved)
                    .Select(be => new UserDTO
                    {
                        UserId = be.UserId,
                        Name = be.User.Name,
                        Email = be.User.Email,
                        Role = (UserRoleDTO)Enum.Parse(typeof(UserRoleDTO), be.Role, true),
                        CreatedAt = be.User.CreatedAt
                    }).ToList(),
                Employees = business.BusinessEmployees
                    .Where(be => be.Role == "Employee" && be.IsApproved)
                    .Select(be => new UserDTO
                    {
                        UserId = be.UserId,
                        Name = be.User.Name,
                        Email = be.User.Email,
                        Role = (UserRoleDTO)Enum.Parse(typeof(UserRoleDTO), be.Role, true),
                        CreatedAt = be.User.CreatedAt
                    }).ToList(),
                ClothingItems = business.ClothingItems.Select(ci => new ClothingItemDTO
                {
                    ClothingItemId = ci.ClothingItemId,
                    BusinessIds = ci.Businesses.Select(biz => biz.BusinessId).ToList(),
                    Description = ci.Description,
                    Price = ci.Price,
                    Quantity = ci.Quantity,
                    ClothingCategoryId  = ci.ClothingCategoryId ,
                    Brand = ci.Brand,
                    Model = ci.Model,
                    PictureUrls = JsonConvert.DeserializeObject<List<string>>(ci.PictureUrls),
                    Colors = JsonConvert.DeserializeObject<List<string>>(ci.Colors),
                    Sizes = (Application.DTOs.ClothingSize)ci.Sizes,
                    Material = ci.Material,
                    CreatedAt = ci.CreatedAt,
                    UpdatedAt = ci.UpdatedAt
                }).ToList(),
                CreatedAt = business.CreatedAt,
                UpdatedAt = business.UpdatedAt
            };
        }

        public BusinessDTO GetByName(string name)
        {
            var business = _context.Businesses
                .SingleOrDefault(b => b.Name.ToLower() == name.ToLower());

            if (business == null)
                return null;

            return new BusinessDTO
            {
                BusinessId = business.BusinessId,
                Name = business.Name,
                Description = business.Description,
                CoverPictureUrl = business.CoverPictureUrl,
                ProfilePictureUrl = business.ProfilePictureUrl,
                OpeningHours = business.OpeningHours,
                Location = business.Location,
                BusinessPhoneNumber = business.BusinessPhoneNumber,
                Address = business.Address,
                NIPT = business.NIPT,
                Owners = business.Owners.Select(o => new UserDTO
                {
                    UserId = o.UserId,
                    Name = o.Name,
                    Email = o.Email,
                    Role = (UserRoleDTO)Enum.Parse(typeof(UserRoleDTO), o.Role, true),
                    CreatedAt = o.CreatedAt
                }).ToList(),
                Employees = business.Employees.Select(e => new UserDTO
                {
                    UserId = e.UserId,
                    Name = e.Name,
                    Email = e.Email,
                    Role = (UserRoleDTO)Enum.Parse(typeof(UserRoleDTO), e.Role, true),
                    CreatedAt = e.CreatedAt
                }).ToList(),
                ClothingItems = business.ClothingItems.Select(ci => new ClothingItemDTO
                {
                    ClothingItemId = ci.ClothingItemId,
                    BusinessIds = ci.Businesses.Select(biz => biz.BusinessId).ToList(),
                    Description = ci.Description,
                    Price = ci.Price,
                    Quantity = ci.Quantity,
                    ClothingCategoryId  = ci.ClothingCategoryId ,
                    Brand = ci.Brand,
                    Model = ci.Model,
                    PictureUrls = JsonConvert.DeserializeObject<List<string>>(ci.PictureUrls),
                    Colors = JsonConvert.DeserializeObject<List<string>>(ci.Colors),
                    Sizes = (Application.DTOs.ClothingSize)ci.Sizes,
                    Material = ci.Material,
                    CreatedAt = ci.CreatedAt,
                    UpdatedAt = ci.UpdatedAt
                }).ToList(),
                CreatedAt = business.CreatedAt,
                UpdatedAt = business.UpdatedAt
            };
        }

        public void Delete(int id)
        {
            int userId = GetCurrentUserId();
            var business = _context.Businesses
                .SingleOrDefault(b => b.BusinessId == id && b.Owners.Any(o => o.UserId == userId));
            if (business == null)
                throw new UnauthorizedAccessException("You do not own this business.");

            _context.Businesses.Remove(business);
            _context.SaveChanges();
        }

        public void Create(BusinessDTO dto)
        {
            var business = new Business
            {
                Name = dto.Name,
                Description = dto.Description,
                CoverPictureUrl = dto.CoverPictureUrl,
                ProfilePictureUrl = dto.ProfilePictureUrl,
                OpeningHours = dto.OpeningHours,
                Location = dto.Location,
                BusinessPhoneNumber = dto.BusinessPhoneNumber,
                Address = dto.Address,
                NIPT = dto.NIPT,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Businesses.Add(business);
            _context.SaveChanges();

            if (dto.Owners == null || !dto.Owners.Any())
                throw new ArgumentException("At least one owner must be specified.");

            foreach (var ownerDto in dto.Owners)
            {
                var owner = _context.Users.SingleOrDefault(u => u.UserId == ownerDto.UserId);
                if (owner != null)
                {
                    var link = new BusinessEmployee
                    {
                        BusinessId = business.BusinessId,
                        UserId = owner.UserId,
                        IsApproved = true,
                        RequestedAt = DateTime.UtcNow,
                        Role = nameof(UserRoleDTO.Owner)
                    };
                    _context.BusinessEmployees.Add(link);
                }
            }

            _context.SaveChanges();
        }

        public async Task Update(int id, BusinessDTO dto)
        {
            int userId = GetCurrentUserId();

            var business = _context.Businesses
                .Include(b => b.BusinessEmployees)
                .SingleOrDefault(b =>
                    b.BusinessId == id &&
                    b.BusinessEmployees.Any(be =>
                        be.UserId == userId &&
                        be.Role == "Owner" &&
                        be.IsApproved));

            if (business == null)
                throw new UnauthorizedAccessException("You do not own this business.");

            business.Name = dto.Name;
            business.Description = dto.Description;
            business.CoverPictureUrl = dto.CoverPictureUrl;
            business.ProfilePictureUrl = dto.ProfilePictureUrl;
            business.OpeningHours = dto.OpeningHours;
            business.Location = dto.Location;
            business.BusinessPhoneNumber = dto.BusinessPhoneNumber;
            business.Address = dto.Address;
            business.NIPT = dto.NIPT;
            business.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        public async Task<List<BusinessDTO>> SearchByClothingAttributeAsync(string attribute, string value)
        {
            var val = value.Trim().ToLower();

            IQueryable<ClothingItem> itemsQ = _context.ClothingItems
                .Include(ci => ci.Businesses);

            switch (attribute.Trim().ToLower())
            {
                case "name":
                    itemsQ = itemsQ.Where(ci => ci.Name.ToLower().Contains(val));
                    break;
                case "description":
                    itemsQ = itemsQ.Where(ci => ci.Description.ToLower().Contains(val));
                    break;
                case "color":
                case "colors":
                    itemsQ = itemsQ.Where(ci => ci.Colors.ToLower().Contains(val));
                    break;
                case "size":
                    if (!Enum.TryParse<ClothingSize>(value, true, out var sz))
                        throw new ArgumentException($"Invalid size: {value}");
                    itemsQ = itemsQ.Where(ci => ci.Sizes == sz);
                    break;
                case "brand":
                    itemsQ = itemsQ.Where(ci => ci.Brand.ToLower().Contains(val));
                    break;
                case "model":
                    itemsQ = itemsQ.Where(ci => ci.Model.ToLower().Contains(val));
                    break;
                case "material":
                    itemsQ = itemsQ.Where(ci => ci.Material.ToLower().Contains(val));
                    break;
                default:
                    throw new ArgumentException($"Unsupported attribute: {attribute}");
            }

            var bizIds = await itemsQ
                .SelectMany(ci => ci.Businesses.Select(b => b.BusinessId))
                .Distinct()
                .ToListAsync();

            var allBizDtos = ViewAllBusinesses();
            return allBizDtos
                .Where(dto => bizIds.Contains(dto.BusinessId))
                .ToList();
        }

        public async Task<bool> RespondToEmployeeInvitationAsync(int businessId, int userId, bool approve)
{
    var invite = await _context.BusinessEmployees
        .FirstOrDefaultAsync(be =>
            be.BusinessId  == businessId &&
            be.UserId      == userId &&
            be.Role        == "Employee" &&
            be.IsApproved == false);

    if (invite == null)
        return false;

    if (approve)
    {
        invite.IsApproved = true;

        var user = await _context.Users.FindAsync(userId);
        if (user != null)
            user.Role = "Employee";
    }
    else
    {
        _context.BusinessEmployees.Remove(invite);
    }

    await _context.SaveChangesAsync();
    return true;
}


        public async Task<PaginatedResult<BusinessDTO>> GetPaginatedBusinessesAsync(int pageNumber, int pageSize)
        {
            var query = _context.Businesses
                .OrderBy(b => b.Name) 
                .Select(b => new BusinessDTO
                {
                    BusinessId = b.BusinessId,
                    Name = b.Name,
                    Description = b.Description,
                    CoverPictureUrl = b.CoverPictureUrl,
                    ProfilePictureUrl = b.ProfilePictureUrl,
                    OpeningHours = b.OpeningHours,
                    Location = b.Location,
                    BusinessPhoneNumber = b.BusinessPhoneNumber,
                    Address = b.Address,
                    NIPT = b.NIPT,
                    CreatedAt = b.CreatedAt,
                    UpdatedAt = b.UpdatedAt
                });
            return await query.ToPaginatedListAsync(pageNumber, pageSize);
        }



    }
}
