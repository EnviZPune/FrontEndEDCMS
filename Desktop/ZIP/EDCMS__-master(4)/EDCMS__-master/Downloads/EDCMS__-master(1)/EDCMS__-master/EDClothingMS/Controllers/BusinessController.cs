using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Infrastructure;
using Application.Services;
using Application.DTOs;          
using DA = Domain.Aggregates;

namespace EDClothingMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BusinessController : ControllerBase
    {
        private readonly ClothingStoreDbContext _db;
        private readonly INotificationService _notify;
        private readonly BusinessService _businessService;

        public BusinessController(
            ClothingStoreDbContext db,
            INotificationService notify,
            BusinessService businessService)
        {
            _db = db;
            _notify = notify;
            _businessService = businessService;
        }

        private bool TryGetUserId(out int userId)
        {
            userId = 0;
            var claim = User.FindFirst("UserId")?.Value;
            return int.TryParse(claim, out userId);
        }

        [HttpPost]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> Create([FromBody] CreateBusinessRequest req)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var userEntity = await _db.Users.FindAsync(userId);
            if (userEntity == null || userEntity.Role != "Owner")
                return Forbid();

            var biz = new DA.Business
            {
                Name = req.Name,
                Description = req.Description,
                Address = req.Address,
                Location = req.Location,
                BusinessPhoneNumber = req.BusinessPhoneNumber,
                NIPT = req.Nipt,
                CoverPictureUrl = req.CoverPictureUrl,
                ProfilePictureUrl = req.ProfilePictureUrl,
                OpeningHours = req.OpeningHours,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.Businesses.Add(biz);
            await _db.SaveChangesAsync();

            _db.BusinessEmployees.Add(new DA.BusinessEmployee
            {
                BusinessId = biz.BusinessId,
                UserId = userId,
                IsApproved = true,
                RequestedAt = DateTime.UtcNow,
                Role = "Owner"
            });
            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = biz.BusinessId }, biz);
        }

        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(int id)
        {
            var biz = await _db.Businesses.FindAsync(id);
            if (biz == null) return NotFound();
            return Ok(biz);
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll()
        {
            var list = await _db.Businesses.ToListAsync();
            return Ok(list);
        }

        [HttpPost("{id}/assign/{userId}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> AssignEmployee(int id, int userId)
        {
            if (!TryGetUserId(out var ownerId))
                return Unauthorized();

            var biz = await _db.Businesses
                .Include(b => b.BusinessEmployees)
                .ThenInclude(be => be.User)
                .SingleOrDefaultAsync(b => b.BusinessId == id);

            if (biz == null ||
                !biz.BusinessEmployees.Any(be =>
                    be.UserId == ownerId &&
                    be.Role == "Owner" &&
                    be.IsApproved))
                return Forbid();

            if (await _db.BusinessEmployees.FindAsync(id, userId) != null)
                return BadRequest("Already invited or employee.");

            _db.BusinessEmployees.Add(new DA.BusinessEmployee
            {
                BusinessId = id,
                UserId = userId,
                IsApproved = false,
                RequestedAt = DateTime.UtcNow,
                Role = "Employee"
            });
            await _db.SaveChangesAsync();

            await _notify.NotifyAsync(
                userId,
                $"You have been invited as an employee for {biz.Name}."
            );
            return Ok();
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> UpdateBusiness(int id, [FromBody] BusinessDTO dto)
        {
            if (!TryGetUserId(out var ownerId))
                return Unauthorized();

            var biz = await _db.Businesses
                .Include(b => b.BusinessEmployees)
                .SingleOrDefaultAsync(b => b.BusinessId == id);

            if (biz == null ||
                !biz.BusinessEmployees.Any(be =>
                    be.UserId == ownerId &&
                    be.Role == "Owner" &&
                    be.IsApproved))
                return Forbid();

            await _businessService.Update(id, dto);
            return NoContent();
        }

        [HttpDelete("{businessId:int}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> DeleteBusiness(int businessId)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var biz = await _db.Businesses
                .Include(b => b.BusinessEmployees)
                .SingleOrDefaultAsync(b => b.BusinessId == businessId);
            if (biz == null) return NotFound();

            var isOwner = biz.BusinessEmployees.Any(be =>
                be.UserId == userId &&
                be.Role == "Owner" &&
                be.IsApproved);
            if (!isOwner) return Forbid();

            _db.Businesses.Remove(biz);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("employees/{businessId}/{userId}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> ApproveEmployee(
            int businessId,
            int userId,
            [FromQuery] bool approve)
        {
            if (!TryGetUserId(out var ownerId))
                return Unauthorized();

            var biz = await _db.Businesses
                .Include(b => b.BusinessEmployees)
                .SingleOrDefaultAsync(b => b.BusinessId == businessId);

            if (biz == null ||
                !biz.BusinessEmployees.Any(be =>
                    be.UserId == ownerId &&
                    be.Role == "Owner" &&
                    be.IsApproved))
                return Forbid();

            var entry = await _db.BusinessEmployees.FindAsync(businessId, userId);
            if (entry == null) return NotFound();

            entry.IsApproved = approve;
            var userEntity = await _db.Users.FindAsync(userId);
            if (userEntity != null &&
                !userEntity.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase))
            {
                userEntity.Role = approve ? "Employee" : "User";
            }

            await _db.SaveChangesAsync();

            var msg = approve
                ? "Your access request was approved."
                : "Your access request was rejected.";
            await _notify.NotifyAsync(userId, msg);

            return Ok();
        }

        [HttpDelete("{businessId}/employees/{userId}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> RemoveEmployee(int businessId, int userId)
        {
            if (!TryGetUserId(out var ownerId))
                return Unauthorized();

            var biz = await _db.Businesses
                .Include(b => b.BusinessEmployees)
                .ThenInclude(be => be.User)
                .SingleOrDefaultAsync(b => b.BusinessId == businessId);

            if (biz == null ||
                !biz.BusinessEmployees.Any(be =>
                    be.UserId == ownerId &&
                    be.Role == "Owner" &&
                    be.IsApproved))
                return Forbid();

            var entry = await _db.BusinessEmployees.FindAsync(businessId, userId);
            if (entry == null) return NotFound();

            _db.BusinessEmployees.Remove(entry);
            entry.User.Role = "User";
            await _db.SaveChangesAsync();

            await _notify.NotifyAsync(userId, "You have been removed as an employee.");
            return Ok();
        }

        [HttpGet("search")]
        [AllowAnonymous]
        public async Task<IActionResult> SearchByClothing(
            [FromQuery] string attribute,
            [FromQuery] string value)
        {
            var shops = await _businessService.SearchByClothingAttributeAsync(attribute, value);
            return Ok(shops);
        }

        [HttpGet("{bizId}/employees/pending")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> GetPendingEmployeesForOwner(int bizId)
        {
            if (!TryGetUserId(out var ownerId))
                return Unauthorized();

            var biz = await _db.Businesses
                .Include(b => b.BusinessEmployees)
                .ThenInclude(be => be.User)
                .SingleOrDefaultAsync(b => b.BusinessId == bizId);
            if (biz == null) return NotFound();

            var isOwner = biz.BusinessEmployees.Any(be =>
                be.UserId == ownerId &&
                be.Role == "Owner" &&
                be.IsApproved);
            if (!isOwner) return Forbid();

            var pending = biz.BusinessEmployees
                .Where(be => be.Role == "Employee" && !be.IsApproved)
                .Select(be => new
                {
                    be.UserId,
                    be.User.Name,
                    be.User.Email,
                    InvitedAt = be.RequestedAt
                })
                .ToList();

            return Ok(pending);
        }

        [HttpGet("employees/pending")]
        [Authorize]
        public async Task<IActionResult> GetMyPendingInvites()
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var pending = await _db.BusinessEmployees
                .Where(be =>
                    be.UserId == userId &&
                    be.Role == "Employee" &&
                    !be.IsApproved)
                .Include(be => be.Business)
                .Select(be => new
                {
                    be.Business.BusinessId,
                    be.Business.Name,
                    be.RequestedAt
                })
                .ToListAsync();

            return Ok(pending);
        }

        [HttpPut("employees/respond/{businessId}")]
        [Authorize]
        public async Task<IActionResult> RespondToInvitation(
            [FromRoute] int businessId,
            [FromQuery] bool approve)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var ok = await _businessService
                .RespondToEmployeeInvitationAsync(businessId, userId, approve);
            if (!ok)
                return Forbid();

            return NoContent();
        }

        [HttpGet("my/businesses")]
        [Authorize]
        public async Task<IActionResult> GetMyBusinesses()
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var list = await _db.BusinessEmployees
                .Where(be => be.UserId == userId && be.IsApproved)
                .Include(be => be.Business)
                .Select(be => new
                {
                    be.Business.BusinessId,
                    be.Business.Name
                })
                .ToListAsync();

            return Ok(list);
        }

        [HttpGet("{id:int}/employees")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> GetEmployees(int id)
        {
            var users = await _db.BusinessEmployees
                .Where(be => be.BusinessId == id && be.IsApproved && be.Role == "Employee")
                .Select(be => be.User)
                .ToListAsync();

            return Ok(users);
        }

        [HttpGet("{id}/pending-changes")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> GetPendingChanges(int id)
        {
            var exists = await _db.Businesses.AnyAsync(b => b.BusinessId == id);
            if (!exists)
                return NotFound();

            var pending = await _db.ProposedChanges
                .Where(pc => pc.BusinessId == id && pc.IsApproved != true)
                .Include(pc => pc.RequestedByUser)
                .OrderByDescending(pc => pc.RequestedAt)
                .ToListAsync();

            var dtoList = pending.Select(pc => new ProposedChangeDTO
            {
                ProposedChangeId = pc.ProposedChangeId,
                ClothingItemId   = pc.ItemId ?? 0,
                EmployeeId       = pc.RequestedByUserId,
                ChangeDetails    = pc.PayloadJson,
                OperationType    = pc.Type.ToString(),
                BusinessId       = pc.BusinessId,
                Status = pc.IsApproved == null
                    ? ProposedChangeStatusDTO.Pending
                    : (pc.IsApproved == true
                        ? ProposedChangeStatusDTO.Approved
                        : ProposedChangeStatusDTO.Rejected),
                CreatedAt  = pc.RequestedAt,
                ReviewedAt = pc.ResolvedAt
            }).ToList();

            return Ok(dtoList);
        }

        [HttpGet("paginated")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPaginatedBusinesses(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            var result = await _businessService.GetPaginatedBusinessesAsync(pageNumber, pageSize);
            return Ok(result);
        }
    }

    public class CreateBusinessRequest
    {
        [Required, StringLength(50)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string Description { get; set; }

        [StringLength(100)]
        public string Address { get; set; }

        [StringLength(100)]
        public string Location { get; set; }

        [StringLength(20)]
        public string BusinessPhoneNumber { get; set; }

        [StringLength(100)]
        public string Nipt { get; set; }

        [StringLength(100)]
        public string CoverPictureUrl { get; set; }

        [StringLength(100)]
        public string ProfilePictureUrl { get; set; }

        [StringLength(20)]
        public string OpeningHours { get; set; }
    }
}
