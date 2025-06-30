using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Application.DTOs;    // contains ProposedChangeDTO, ClothingItemDTO, ProposedChangeStatusDTO, etc.
using Domain.Aggregates;   // contains ClothingItem, ChangeType, ProposedChange, etc.
using Infrastructure;      // contains ClothingStoreDbContext, INotificationService

namespace Application.Services
{
    public interface IProposedChangeService
    {
        Task<ProposedChange> SubmitChangeAsync(int businessId, int userId, ChangeType type, ClothingItemDTO itemDto);
        Task<IEnumerable<ProposedChangeDTO>> GetPendingAsync(int businessId);
        Task ApproveRejectAsync(int changeId, bool approve);
    }

    public class ProposedChangeService : IProposedChangeService
    {
        private readonly ClothingStoreDbContext _db;
        private readonly INotificationService   _notificationService;

        public ProposedChangeService(
            ClothingStoreDbContext db,
            INotificationService   notificationService)
        {
            _db                   = db;
            _notificationService  = notificationService;
        }

        public async Task<ProposedChange> SubmitChangeAsync(
            int businessId,
            int userId,
            ChangeType type,
            ClothingItemDTO itemDto)
        {
            var payload = JsonSerializer.Serialize(itemDto);
            var pc = new ProposedChange
            {
                BusinessId        = businessId,
                Type              = type,
                ItemId            = itemDto.ClothingItemId == 0 ? null : (int?)itemDto.ClothingItemId,
                PayloadJson       = payload,
                RequestedByUserId = userId,
                RequestedAt       = DateTime.UtcNow,
                IsApproved        = null
            };

            _db.ProposedChanges.Add(pc);
            await _db.SaveChangesAsync();

            var business = await _db.Businesses
                .Include(b => b.BusinessEmployees)
                    .ThenInclude(be => be.User)
                .SingleOrDefaultAsync(b => b.BusinessId == businessId);

            if (business != null)
            {
                var employee = await _db.Users.FindAsync(userId);
                var name     = employee?.Name ?? "An employee";
                var summary  = itemDto.Name ?? "a change";
                var message  = $"{name} requested '{summary}' on '{business.Name}'. Please review.";

                foreach (var ownerBe in business.BusinessEmployees
                            .Where(be => be.Role == "Owner" && be.IsApproved))
                {
                    await _notificationService.NotifyAsync(ownerBe.UserId, message);
                }
            }

            return pc;
        }

        public async Task<IEnumerable<ProposedChangeDTO>> GetPendingAsync(int businessId)
        {
            var pending = await _db.ProposedChanges
                .Where(pc => pc.BusinessId == businessId && pc.IsApproved == null)
                .OrderByDescending(pc => pc.RequestedAt)
                .ToListAsync();

            return pending.Select(pc => new ProposedChangeDTO
            {
                ProposedChangeId = pc.ProposedChangeId,
                ClothingItemId   = pc.ItemId ?? 0,
                EmployeeId       = pc.RequestedByUserId,
                BusinessId       = pc.BusinessId,
                ChangeDetails    = pc.PayloadJson,
                OperationType    = pc.Type.ToString(),
                Status           = ProposedChangeStatusDTO.Pending,
                CreatedAt        = pc.RequestedAt,
                ReviewedAt       = pc.ResolvedAt
            });
        }

        public async Task ApproveRejectAsync(int changeId, bool approve)
        {
            var pc = await _db.ProposedChanges
                .SingleOrDefaultAsync(x => x.ProposedChangeId == changeId);

            if (pc == null)
                throw new KeyNotFoundException("Proposed change not found.");

            if (approve)
            {
                var itemDto = JsonSerializer.Deserialize<ClothingItemDTO>(pc.PayloadJson)
                              ?? throw new InvalidOperationException("Invalid payload.");

                switch (pc.Type)
                {
                    case ChangeType.Create:
                        var newItem = new ClothingItem
                        {
                            Name        = itemDto.Name,
                            Description = itemDto.Description,
                            Price       = itemDto.Price,
                            Quantity    = itemDto.Quantity,
                            ClothingCategoryId     = itemDto.ClothingCategoryId ,
                            Brand       = itemDto.Brand,
                            Model       = itemDto.Model,
                            PictureUrls = JsonSerializer.Serialize(itemDto.PictureUrls),
                            Colors      = JsonSerializer.Serialize(itemDto.Colors),
                            Sizes       = (Domain.Aggregates.ClothingSize)itemDto.Sizes,
                            Material    = itemDto.Material,
                            CreatedAt   = DateTime.UtcNow,
                            UpdatedAt   = DateTime.UtcNow
                        };
                        var bizForCreate = await _db.Businesses.FindAsync(pc.BusinessId);
                        if (bizForCreate != null)
                            newItem.Businesses.Add(bizForCreate);
                        _db.ClothingItems.Add(newItem);
                        break;

                    case ChangeType.Update:
                        if (!pc.ItemId.HasValue)
                            throw new InvalidOperationException("No item to update.");
                        var existing = await _db.ClothingItems
                            .SingleOrDefaultAsync(ci => ci.ClothingItemId == pc.ItemId.Value);
                        if (existing != null)
                        {
                            existing.Name        = itemDto.Name;
                            existing.Description = itemDto.Description;
                            existing.Price       = itemDto.Price;
                            existing.Quantity    = itemDto.Quantity;
                            existing.ClothingCategoryId     = itemDto.ClothingCategoryId ;
                            existing.Brand       = itemDto.Brand;
                            existing.Model       = itemDto.Model;
                            existing.PictureUrls = JsonSerializer.Serialize(itemDto.PictureUrls);
                            existing.Colors      = JsonSerializer.Serialize(itemDto.Colors);
                            existing.Sizes       = (Domain.Aggregates.ClothingSize)itemDto.Sizes;
                            existing.Material    = itemDto.Material;
                            existing.UpdatedAt   = DateTime.UtcNow;
                        }
                        break;

                    case ChangeType.Delete:
                        if (!pc.ItemId.HasValue)
                            throw new InvalidOperationException("No item to delete.");
                        var toRemove = await _db.ClothingItems
                            .Include(ci => ci.Businesses)       // load relationships
                            .SingleOrDefaultAsync(ci => ci.ClothingItemId == pc.ItemId.Value);
                        if (toRemove != null)
                        {
                            toRemove.Businesses.Clear();       // drop join‐rows
                            _db.ClothingItems.Remove(toRemove);
                        }
                        break;

                    default:
                        throw new InvalidOperationException("Unknown change type.");
                }
            }

            pc.IsApproved = approve;
            pc.ResolvedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            // notify the original requester
            var requester = await _db.Users.FindAsync(pc.RequestedByUserId);
            if (requester != null)
            {
                var business = await _db.Businesses.FindAsync(pc.BusinessId);
                var name     = business?.Name ?? "your shop";
                var status   = approve ? "approved" : "rejected";
                var text     = $"Your change request on '{name}' was {status}.";
                await _notificationService.NotifyAsync(requester.UserId, text);
            }
        }
    }
}
