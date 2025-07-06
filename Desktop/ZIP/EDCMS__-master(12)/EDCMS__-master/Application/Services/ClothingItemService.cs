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
using Infrastructure.utils.PaginationWrapper;  
using Infrastructure.utils.GroupByWrapper;     
using Infrastructure.Extensions;                

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
                return;
            }

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
                Sizes              = (ClothingSize)(int)dto.Sizes,
                Material           = dto.Material,
                ClothingCategoryId = dto.ClothingCategoryId,
                CreatedAt          = DateTime.UtcNow,
                UpdatedAt          = DateTime.UtcNow
            };

            foreach (var b in dto.BusinessIds)
            {
                var biz = await _context.Businesses.FindAsync(b);
                if (biz != null)
                    item.Businesses.Add(biz);
            }

            _context.ClothingItems.Add(item);
            await _context.SaveChangesAsync();
        }

        public async Task<string> UpdateClothingItemAsync(int id, ClothingItemDTO dto, int userId)
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
                return $"A proposed update for item ({dto.Name}) has been submitted.";
            }

            var item = await _context.ClothingItems
                .Include(ci => ci.Businesses)
                .FirstOrDefaultAsync(ci => ci.ClothingItemId == id);

            if (item == null)
                throw new KeyNotFoundException("Clothing item not found.");

            var changes = new List<string>();

            if (!string.Equals(item.Name, dto.Name, StringComparison.Ordinal))
            {
                changes.Add($"name from '{item.Name}' to '{dto.Name}'");
                item.Name = dto.Name;
            }
            if (item.Price != dto.Price)
            {
                changes.Add($"price from {item.Price:C} to {dto.Price:C}");
                item.Price = dto.Price;
            }
            if (item.Quantity != dto.Quantity)
            {
                changes.Add($"quantity from {item.Quantity} to {dto.Quantity}");
                item.Quantity = dto.Quantity;
            }
            if (!string.Equals(item.Description, dto.Description, StringComparison.Ordinal))
            {
                changes.Add("description updated");
                item.Description = dto.Description;
            }

            if (dto.ClothingCategoryId.HasValue &&
                item.ClothingCategoryId != dto.ClothingCategoryId.Value)
            {
                changes.Add($"category changed");
                item.ClothingCategoryId = dto.ClothingCategoryId.Value;
            }
            if (!string.Equals(item.Brand, dto.Brand, StringComparison.Ordinal))
            {
                changes.Add($"brand from '{item.Brand}' to '{dto.Brand}'");
                item.Brand = dto.Brand;
            }
            if (!string.Equals(item.Model, dto.Model, StringComparison.Ordinal))
            {
                changes.Add($"model from '{item.Model}' to '{dto.Model}'");
                item.Model = dto.Model;
            }

            item.PictureUrls = JsonConvert.SerializeObject(dto.PictureUrls);
            item.Colors      = JsonConvert.SerializeObject(dto.Colors);
            item.Sizes       = (ClothingSize)(int)dto.Sizes;
            item.Material    = dto.Material;
            item.UpdatedAt   = DateTime.UtcNow;

            item.Businesses.Clear();
            foreach (var b in dto.BusinessIds)
            {
                var biz = await _context.Businesses.FindAsync(b);
                if (biz != null)
                    item.Businesses.Add(biz);
            }

            await _context.SaveChangesAsync();

            var detail = changes.Count > 0
                ? string.Join("; ", changes)
                : "no tracked fields changed";

            return $"Item ({item.Name}) was updated: {detail}.";
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
                return;
            }

            var related = await _context.ProposedChanges
                .Where(pc => pc.ItemId == id)
                .ToListAsync();

            if (related.Any())
                _context.ProposedChanges.RemoveRange(related);

            item.Businesses.Clear();
            _context.ClothingItems.Remove(item);

            await _context.SaveChangesAsync();
        }

        public bool IsEmployeeAssignedToBusiness(int userId, int businessId)
        {
            return _context.BusinessEmployees.Any(be =>
                be.UserId     == userId &&
                be.BusinessId == businessId &&
                be.Role       == "Employee" &&
                be.IsApproved);
        }

        public async Task<PaginatedResult<ClothingItemDTO>> GetPaginatedClothingItems(
            PaginationRequest paginationRequest,
            int businessId)
        {
            var query = _context.ClothingItems
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
                    ClothingCategoryName = ci.ClothingCategory != null ? ci.ClothingCategory.Name : null,
                    BusinessIds          = ci.Businesses.Select(b => b.BusinessId).ToList()
                });

            return await query.ToPaginatedListAsync(
                paginationRequest.PageNumber,
                paginationRequest.PageSize
            );
        }

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
        }
    }
}
