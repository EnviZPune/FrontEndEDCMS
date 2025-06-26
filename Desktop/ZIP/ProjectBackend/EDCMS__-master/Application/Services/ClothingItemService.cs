// ClothingItemService.cs

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
using Application.DTOs.Pagination;
using Infrastructure.utils.PaginationWrapper;   // for PaginatedResult<T> and ToPaginatedListAsync
using Infrastructure.utils.GroupByWrapper;      // for GroupByResult<T>
using Infrastructure.Extensions;                // for GroupByItemAsync

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
            _context               = context;
            _proposedChangeService = proposedChangeService;
        }

        public IEnumerable<ClothingItem> GetAll(int businessId)
        {
            return _context.ClothingItems
                .Include(ci => ci.ClothingCategory)
                .Where(ci => ci.Businesses.Any(b => b.BusinessId == businessId))
                .ToList();
        }

        public ClothingItem GetById(int id)
        {
            return _context.ClothingItems
                .Include(ci => ci.Businesses)
                .Include(ci => ci.ClothingCategory)
                .FirstOrDefault(ci => ci.ClothingItemId == id);
        }

        private bool IsEmployeeAssignedToAllBusinesses(int userId, List<int> businessIds)
        {
            foreach (var bid in businessIds)
            {
                var biz = _context.Businesses
                    .Include(b => b.BusinessEmployees)
                    .FirstOrDefault(b => b.BusinessId == bid);

                if (biz == null ||
                    !biz.BusinessEmployees.Any(be =>
                        be.UserId     == userId &&
                        be.Role       == "Employee" &&
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
            var isEmp = _context.BusinessEmployees.Any(be =>
                be.UserId     == userId &&
                be.BusinessId == bizId &&
                be.Role       == "Employee" &&
                be.IsApproved);

            if (isEmp && IsEmployeeAssignedToAllBusinesses(userId, dto.BusinessIds))
            {
                dto.ClothingItemId = 0;
                await _proposedChangeService.SubmitChangeAsync(
                    bizId, userId, ChangeType.Create, dto);
            }
            else
            {
                var item = new ClothingItem
                {
                    Name               = dto.Name,
                    Description        = dto.Description,
                    Price              = dto.Price,
                    Quantity           = dto.Quantity,
                    Brand              = dto.Brand,
                    Model              = dto.Model,
                    PictureUrls        = JsonConvert.SerializeObject(dto.PictureUrls),
                    Colors             = JsonConvert.SerializeObject(dto.Colors),
                    Sizes              = (ClothingSize)dto.Sizes,
                    Material           = dto.Material,
                    ClothingCategoryId = dto.ClothingCategoryId ?? 0,
                    CreatedAt          = DateTime.UtcNow,
                    UpdatedAt          = DateTime.UtcNow
                };
                foreach (var b in dto.BusinessIds)
                {
                    var biz = await _context.Businesses.FindAsync(b);
                    if (biz != null) item.Businesses.Add(biz);
                }
                _context.ClothingItems.Add(item);
                await _context.SaveChangesAsync();
            }
        }

        public async Task UpdateClothingItemAsync(int id, ClothingItemDTO dto, int userId)
        {
            var bizId = dto.BusinessIds.First();
            var isEmp = _context.BusinessEmployees.Any(be =>
                be.UserId     == userId &&
                be.BusinessId == bizId &&
                be.Role       == "Employee" &&
                be.IsApproved);

            if (isEmp && IsEmployeeAssignedToAllBusinesses(userId, dto.BusinessIds))
            {
                dto.ClothingItemId = id;
                await _proposedChangeService.SubmitChangeAsync(
                    bizId, userId, ChangeType.Update, dto);
            }
            else
            {
                var item = await _context.ClothingItems
                    .Include(ci => ci.Businesses)
                    .FirstOrDefaultAsync(ci => ci.ClothingItemId == id);
                if (item == null)
                    throw new KeyNotFoundException("Clothing item not found.");

                item.Name               = dto.Name;
                item.Description        = dto.Description;
                item.Price              = dto.Price;
                item.Quantity           = dto.Quantity;
                item.ClothingCategoryId = dto.ClothingCategoryId ?? item.ClothingCategoryId;
                item.Brand              = dto.Brand;
                item.Model              = dto.Model;
                item.PictureUrls        = JsonConvert.SerializeObject(dto.PictureUrls);
                item.Colors             = JsonConvert.SerializeObject(dto.Colors);
                item.Sizes              = (ClothingSize)dto.Sizes;
                item.Material           = dto.Material;
                item.UpdatedAt          = DateTime.UtcNow;

                item.Businesses.Clear();
                foreach (var b in dto.BusinessIds)
                {
                    var biz = await _context.Businesses.FindAsync(b);
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
            var bizId  = bizIds.First();

            var isEmp = _context.BusinessEmployees.Any(be =>
                be.UserId     == userId &&
                be.BusinessId == bizId &&
                be.Role       == "Employee" &&
                be.IsApproved);

            if (isEmp && IsEmployeeAssignedToAllBusinesses(userId, bizIds))
            {
                await _proposedChangeService.SubmitChangeAsync(
                    bizId, userId, ChangeType.Delete,
                    new ClothingItemDTO { ClothingItemId = id, BusinessIds = bizIds });
            }
            else
            {
                var related = await _context.ProposedChanges
                    .Where(pc => pc.ItemId == id)
                    .ToListAsync();
                if (related.Any())
                    _context.ProposedChanges.RemoveRange(related);

                item.Businesses.Clear();
                _context.ClothingItems.Remove(item);
                await _context.SaveChangesAsync();
            }
        }

        public bool IsEmployeeAssignedToBusiness(int userId, int businessId)
        {
            return _context.BusinessEmployees.Any(be =>
                be.UserId     == userId &&
                be.BusinessId == businessId &&
                be.Role       == "Employee" &&
                be.IsApproved);
        }

        // --------------------------------------------------------------------
        // paginated list of DTOs
        public async Task<PaginatedResult<ClothingItemDTO>> GetPaginatedClothingItems(
            PaginationRequest paginationRequest,
            int businessId)
        {
            var query = _context.ClothingItems
                .Include(ci => ci.ClothingCategory)
                .Where(ci => ci.Businesses.Any(b => b.BusinessId == businessId))
                .Select(ci => new ClothingItemDTO
                {
                    ClothingItemId       = ci.ClothingItemId,
                    Name                 = ci.Name,
                    Description          = ci.Description,
                    Price                = ci.Price,
                    Quantity             = ci.Quantity,
                    Brand                = ci.Brand,
                    Model                = ci.Model,
                    PictureUrls          = JsonConvert.DeserializeObject<List<string>>(ci.PictureUrls),
                    Colors               = JsonConvert.DeserializeObject<List<string>>(ci.Colors),
                    Sizes                = (Application.DTOs.ClothingSize)(int)ci.Sizes,
                    Material             = ci.Material,
                    ClothingCategoryId   = ci.ClothingCategoryId,
                    ClothingCategoryName = ci.ClothingCategory != null
                        ? ci.ClothingCategory.Name
                        : null
                });

            return await query.ToPaginatedListAsync(
                paginationRequest.PageNumber,
                paginationRequest.PageSize
            );
        }

        // --------------------------------------------------------------------
        // grouped by a key (only "Category" supported)
        public async Task<GroupByResult<ClothingItemDTO>> GetGroupByItems(
            int businessId,
            string key,
            PaginationRequest paginationRequest)
        {
            if (paginationRequest == null)
                throw new ArgumentNullException(nameof(paginationRequest));
            if (!key.Equals("Category", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Only grouping by Category is supported", nameof(key));

            var dtoQuery = _context.ClothingItems
                .Include(ci => ci.ClothingCategory)
                .Include(ci => ci.Businesses)
                .Where(ci => ci.Businesses.Any(b => b.BusinessId == businessId))
                .Select(ci => new ClothingItemDTO
                {
                    ClothingItemId       = ci.ClothingItemId,
                    Name                 = ci.Name,
                    Description          = ci.Description,
                    Price                = ci.Price,
                    Quantity             = ci.Quantity,
                    Brand                = ci.Brand,
                    Model                = ci.Model,
                    PictureUrls          = JsonConvert.DeserializeObject<List<string>>(ci.PictureUrls),
                    Colors               = JsonConvert.DeserializeObject<List<string>>(ci.Colors),
                    Sizes                = (Application.DTOs.ClothingSize)(int)ci.Sizes,
                    Material             = ci.Material,
                    ClothingCategoryId   = ci.ClothingCategoryId,
                    ClothingCategoryName = ci.ClothingCategory!.Name,
                    BusinessIds          = ci.Businesses.Select(b => b.BusinessId).ToList()
                });

            return await dtoQuery.GroupByItemAsync(
                key:        key,
                paginated:  true,
                pageNumber: paginationRequest.PageNumber,
                pageSize:   paginationRequest.PageSize
            );
        }cd
    }
}
