using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Application.DTOs;
using Domain.Aggregates;
using Infrastructure;
using Newtonsoft.Json;
using ClothingSize = Domain.Aggregates.ClothingSize;
using Infrastructure.utils.PaginationWrapper;
using Application.DTOs.Pagination;
using Infrastructure.Extensions;
using Infrastructure.utils.GroupByWrapper;

namespace Application.Services
{
    public class ClothingItemService
    {
        private readonly ClothingStoreDbContext _context;
        private readonly IProposedChangeService _proposedChangeService;

        public ClothingItemService(
            ClothingStoreDbContext context,
            IProposedChangeService proposedChangeService)
        {
            _context = context;
            _proposedChangeService = proposedChangeService;
        }

        public IEnumerable<ClothingItem> GetAll(int businessId)
        {
            return _context.ClothingItems
                .Where(ci => ci.Businesses.Any(b => b.BusinessId == businessId))
                .ToList();
        }

        public ClothingItem GetById(int id)
        {
            return _context.ClothingItems
                .Include(ci => ci.Businesses)
                .FirstOrDefault(ci => ci.ClothingItemId == id);
        }

        private bool IsEmployeeAssignedToAllBusinesses(int employeeId, List<int> businessIds)
        {
            foreach (var bid in businessIds)
            {
                var business = _context.Businesses
                    .Include(b => b.BusinessEmployees)
                    .FirstOrDefault(b => b.BusinessId == bid);

                if (business == null ||
                    !business.BusinessEmployees.Any(be =>
                        be.UserId == employeeId &&
                        be.Role == "Employee" &&
                        be.IsApproved))
                {
                    return false;
                }
            }

            return true;
        }

        public async Task CreateClothingItemAsync(ClothingItemDTO dto, int userId)
        {
            var bizId = dto.BusinessIds.First();
            var isEmployee = _context.BusinessEmployees.Any(be =>
                be.UserId == userId &&
                be.BusinessId == bizId &&
                be.Role == "Employee" &&
                be.IsApproved);

            if (isEmployee &&
                IsEmployeeAssignedToAllBusinesses(userId, dto.BusinessIds))
            {
                dto.ClothingItemId = 0;
                await _proposedChangeService.SubmitChangeAsync(
                    bizId,
                    userId,
                    ChangeType.Create,
                    dto);
            }
            else
            {
                var item = new ClothingItem
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    Price = dto.Price,
                    Quantity = dto.Quantity,
                    Category = dto.Category,
                    Brand = dto.Brand,
                    Model = dto.Model,
                    PictureUrls = JsonConvert.SerializeObject(dto.PictureUrls),
                    Colors = JsonConvert.SerializeObject(dto.Colors),
                    Sizes = (ClothingSize)dto.Sizes,
                    Material = dto.Material,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                foreach (var bid in dto.BusinessIds)
                {
                    var biz = await _context.Businesses.FindAsync(bid);
                    if (biz != null) item.Businesses.Add(biz);
                }

                _context.ClothingItems.Add(item);
                await _context.SaveChangesAsync();
            }
        }

        public async Task UpdateClothingItemAsync(int id, ClothingItemDTO dto, int userId)
        {
            var bizId = dto.BusinessIds.First();
            var isEmployee = _context.BusinessEmployees.Any(be =>
                be.UserId == userId &&
                be.BusinessId == bizId &&
                be.Role == "Employee" &&
                be.IsApproved);

            if (isEmployee &&
                IsEmployeeAssignedToAllBusinesses(userId, dto.BusinessIds))
            {
                dto.ClothingItemId = id;
                await _proposedChangeService.SubmitChangeAsync(
                    bizId,
                    userId,
                    ChangeType.Update,
                    dto);
            }
            else
            {
                var item = await _context.ClothingItems
                    .Include(ci => ci.Businesses)
                    .FirstOrDefaultAsync(ci => ci.ClothingItemId == id);
                if (item == null)
                    throw new KeyNotFoundException("Clothing item not found.");

                item.Name = dto.Name;
                item.Description = dto.Description;
                item.Price = dto.Price;
                item.Quantity = dto.Quantity;
                item.Category = dto.Category;
                item.Brand = dto.Brand;
                item.Model = dto.Model;
                item.PictureUrls = JsonConvert.SerializeObject(dto.PictureUrls);
                item.Colors = JsonConvert.SerializeObject(dto.Colors);
                item.Sizes = (ClothingSize)dto.Sizes;
                item.Material = dto.Material;
                item.UpdatedAt = DateTime.UtcNow;

                item.Businesses.Clear();
                foreach (var bid in dto.BusinessIds)
                {
                    var biz = await _context.Businesses.FindAsync(bid);
                    if (biz != null) item.Businesses.Add(biz);
                }

                await _context.SaveChangesAsync();
            }
        }

        public async Task DeleteClothingItemAsync(int id, int userId)
        {
            var item = await _context.ClothingItems
                .Include(ci => ci.Businesses)
                .FirstOrDefaultAsync(ci => ci.ClothingItemId == id);
            if (item == null)
                throw new KeyNotFoundException("Clothing item not found.");

            var bizIds = item.Businesses.Select(b => b.BusinessId).ToList();
            var bizId = bizIds.First();

            var isEmployee = _context.BusinessEmployees.Any(be =>
                be.UserId == userId &&
                be.BusinessId == bizId &&
                be.Role == "Employee" &&
                be.IsApproved);

            if (isEmployee &&
                IsEmployeeAssignedToAllBusinesses(userId, bizIds))
            {
                await _proposedChangeService.SubmitChangeAsync(
                    bizId,
                    userId,
                    ChangeType.Delete,
                    new ClothingItemDTO { ClothingItemId = id, BusinessIds = bizIds });
            }
            else
            {
                var relatedChanges = await _context.ProposedChanges
                    .Where(pc => pc.ItemId == id)
                    .ToListAsync();
                if (relatedChanges.Any())
                    _context.ProposedChanges.RemoveRange(relatedChanges);

                item.Businesses.Clear();

                _context.ClothingItems.Remove(item);
                await _context.SaveChangesAsync();
            }
        }

        public bool IsEmployeeAssignedToBusiness(int employeeId, int businessId)
        {
            return _context.BusinessEmployees
                .Any(be => be.UserId == employeeId
                           && be.BusinessId == businessId
                           && be.Role == "Employee"
                           && be.IsApproved);
        }

        public async Task<List<ClothingItem>> GetItemsByBusinessAsync(
            int businessId,
            ClothingItemFilter filter)
        {
            IQueryable<ClothingItem> q = _context.ClothingItems
                .Include(ci => ci.Businesses)
                .Where(ci => ci.Businesses.Any(b => b.BusinessId == businessId));

            if (!string.IsNullOrWhiteSpace(filter.Name))
                q = q.Where(ci => ci.Name.Contains(filter.Name));

            if (!string.IsNullOrWhiteSpace(filter.Description))
                q = q.Where(ci => ci.Description.Contains(filter.Description));

            if (filter.PriceMin.HasValue)
                q = q.Where(ci => ci.Price >= filter.PriceMin.Value);

            if (filter.PriceMax.HasValue)
                q = q.Where(ci => ci.Price <= filter.PriceMax.Value);

            if (filter.QuantityMin.HasValue)
                q = q.Where(ci => ci.Quantity >= filter.QuantityMin.Value);

            if (filter.QuantityMax.HasValue)
                q = q.Where(ci => ci.Quantity <= filter.QuantityMax.Value);

            if (!string.IsNullOrWhiteSpace(filter.Category))
                q = q.Where(ci => ci.Category.Equals(filter.Category, StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrWhiteSpace(filter.Brand))
                q = q.Where(ci => ci.Brand.Equals(filter.Brand, StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrWhiteSpace(filter.Model))
                q = q.Where(ci => ci.Model.Contains(filter.Model, StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrWhiteSpace(filter.Colors))
                q = q.Where(ci => ci.Colors.Contains(filter.Colors, StringComparison.OrdinalIgnoreCase));

            if (filter.Size.HasValue)
                q = q.Where(ci => ci.Sizes == (ClothingSize)filter.Size.Value);

            if (!string.IsNullOrWhiteSpace(filter.Material))
                q = q.Where(ci => ci.Material.Equals(filter.Material, StringComparison.OrdinalIgnoreCase));

            return await q.ToListAsync();
        }


        public async Task<PaginatedResult<ClothingItemDTO>> GetPaginatedClothingItems(
            PaginationRequest paginationRequest, int businessId)
        {

            var query = _context.ClothingItems
                .Where(ci => ci.Businesses.Any(b => b.BusinessId == businessId))
                .Select(ci => new ClothingItemDTO
                {
                    Category = ci.Category,
                    Brand = ci.Brand,
                    Model = ci.Model,
                    ClothingItemId = ci.ClothingItemId,
                    Colors = new List<string> { ci.Colors },
                    Description = ci.Description,
                    Material = ci.Material,
                    Name = ci.Name,
                    PictureUrls = new List<string> { ci.PictureUrls },
                    Price = ci.Price,
                    Quantity = ci.Quantity,
                    Sizes = (Application.DTOs.ClothingSize)(int)ci.Sizes
                });

            return await query.ToPaginatedListAsync(paginationRequest.PageNumber, paginationRequest.PageSize);
        }

        public async Task<GroupByResult<ClothingItemDTO>> GetGroupByItems(int businessId, string key,
            PaginationRequest paginationRequest)
        {
            if (paginationRequest == null)
                throw new ArgumentNullException(nameof(paginationRequest));

            if (string.IsNullOrWhiteSpace(key))
                throw new ArgumentException("Key must be provided", nameof(key));
            var query = _context.ClothingItems
                .Where(ci => ci.Businesses.Any(b => b.BusinessId == businessId))
                .Select(ci => new ClothingItemDTO
                {
                    ClothingItemId = ci.ClothingItemId,
                    Name = ci.Name,
                    Description = ci.Description,
                    Price = ci.Price,
                    Quantity = ci.Quantity,
                    Category = ci.Category,
                    Brand = ci.Brand,
                    Model = ci.Model,
                    PictureUrls = JsonConvert.DeserializeObject<List<string>>(ci.PictureUrls),
                    Colors = JsonConvert.DeserializeObject<List<string>>(ci.Colors),
                    Sizes = (Application.DTOs.ClothingSize)(int)ci.Sizes,
                    Material = ci.Material
                });

            return await query
                .GroupByItemAsync(
                    key: key,
                    paginated: true,
                    pageNumber: paginationRequest.PageNumber,
                    pageSize: paginationRequest.PageSize
                );
        }
    }
}

