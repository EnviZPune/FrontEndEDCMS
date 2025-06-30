using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json.Serialization;
using Application.DTOs;
using Application.Services;
using Domain.Aggregates;
using Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EDClothingMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProposedChangesController : ControllerBase
    {
        private readonly IProposedChangeService _proposedChangeService;
        private readonly INotificationService _notificationService;
        private readonly ClothingStoreDbContext _db;

        public ProposedChangesController(
            IProposedChangeService proposedChangeService,
            INotificationService notificationService,
            ClothingStoreDbContext db)
        {
            _proposedChangeService = proposedChangeService;
            _notificationService   = notificationService;
            _db                    = db;
        }

        [HttpPost("submit")]
        public async Task<IActionResult> SubmitChange([FromBody] SubmitChangeDto dto)
        {
            // 1. Authenticate employee
            if (!int.TryParse(User.FindFirst("UserId")?.Value, out var userId))
                return Unauthorized("Invalid user token.");

            // 2. Record the proposed change
            var newChange = await _proposedChangeService.SubmitChangeAsync(
                dto.BusinessId,
                userId,
                dto.Type,
                dto.ItemDto
            );

            // 3. Gather names for notification
            var employee = await _db.Users.FindAsync(userId);
            var employeeName  = employee?.Name ?? "An employee";

            var business = await _db.Businesses.FindAsync(dto.BusinessId);
            var businessName = business?.Name ?? "your business";

            var readableType = dto.Type switch
            {
                ChangeType.UpdatePhotos => "a photo update",
                ChangeType.Update      => "an item update",
                ChangeType.Create      => "a creation",
                ChangeType.Delete      => "a deletion",
                _                      => "a change"
            };

            var message = $"{employeeName} submitted {readableType} on business \"{businessName}\".";

            // 4. Notify each approved owner
            var owners = await _db.BusinessEmployees
                .Where(be => be.BusinessId == dto.BusinessId && be.Role == "Owner" && be.IsApproved)
                .Select(be => be.UserId)
                .ToListAsync();

            foreach (var ownerId in owners)
                await _notificationService.NotifyAsync(ownerId, message);

            // 5. Return the created DTO
            var responseDto = new ProposedChangeDTO
            {
                ProposedChangeId = newChange.ProposedChangeId,
                ClothingItemId   = newChange.ItemId ?? 0,
                EmployeeId       = newChange.RequestedByUserId,
                BusinessId       = newChange.BusinessId,
                ChangeDetails    = newChange.PayloadJson,
                OperationType    = newChange.Type.ToString(),
                Status           = ProposedChangeStatusDTO.Pending,
                CreatedAt        = newChange.RequestedAt,
                ReviewedAt       = newChange.ResolvedAt
            };

            return CreatedAtAction(
                nameof(GetPending),
                new { businessId = dto.BusinessId },
                responseDto
            );
        }

        [HttpGet("pending/{businessId:int}")]
        public async Task<IActionResult> GetPending(int businessId)
        {
            if (!int.TryParse(User.FindFirst("UserId")?.Value, out var userId))
                return Unauthorized();

            var isOwner = await _db.BusinessEmployees.AnyAsync(be =>
                be.BusinessId == businessId &&
                be.UserId     == userId &&
                be.Role       == "Owner" &&
                be.IsApproved);

            if (!isOwner) return Forbid();

            var pendingList = await _proposedChangeService.GetPendingAsync(businessId);
            return Ok(pendingList);
        }

        [HttpPut("{changeId:int}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> ApproveReject(
            int changeId,
            [FromQuery] bool approve)
        {
            try
            {
                await _proposedChangeService.ApproveRejectAsync(changeId, approve);
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"No proposed change found with Id = {changeId}.");
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }

            return NoContent();
        }
    }

    public class SubmitChangeDto
    {
        public int BusinessId { get; set; }

        [JsonConverter(typeof(JsonStringEnumConverter))]
        public ChangeType Type { get; set; }

        public ClothingItemDTO ItemDto { get; set; } = null!;
    }
}
