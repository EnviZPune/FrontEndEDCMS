using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Application.DTOs;
using Application.Services;
using Newtonsoft.Json;
using ClothingSize = Application.DTOs.ClothingSize;
using Application.DTOs.Pagination;
using Infrastructure.utils.GroupByWrapper;
using Infrastructure.utils.PaginationWrapper;

namespace EDClothingMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ClothingItemController : ControllerBase
    {
        private readonly ClothingItemService _service;
        private readonly INotificationService _notificationService;

        public ClothingItemController(
            ClothingItemService service,
            INotificationService notificationService)
        {
            _service = service;
            _notificationService = notificationService;
        }

        private bool TryGetUserId(out int userId)
        {
            userId = 0;
            var userIdClaim =
                User.FindFirstValue("UserId") ??
                User.FindFirstValue("http://schemas.microsoft.com/ws/2008/06/identity/claims/nameidentifier") ??
                User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                User.FindFirstValue("sub");

            return !string.IsNullOrEmpty(userIdClaim)
                   && int.TryParse(userIdClaim, out userId);
        }

        private void ValidateEmployeeAccess(int businessId)
        {
            if (!(User.IsInRole("Employee") || User.IsInRole("Owner")))
                throw new UnauthorizedAccessException("User is not an employee or owner.");

            // optional: verify assignment to that business
        }

        [HttpGet("business/{businessId}")]
        public ActionResult<IEnumerable<ClothingItemDTO>> GetByBusiness(int businessId)
        {
            var items = _service.GetAll(businessId);
            var dtos = items.Select(ci => new ClothingItemDTO
            {
                ClothingItemId = ci.ClothingItemId,
                Name = ci.Name,
                Description = ci.Description,
                Price = ci.Price,
                Quantity = ci.Quantity,
                ClothingCategoryId = ci.ClothingCategoryId,
                Brand = ci.Brand,
                Model = ci.Model,
                PictureUrls = JsonConvert.DeserializeObject<List<string>>(ci.PictureUrls),
                Colors = JsonConvert.DeserializeObject<List<string>>(ci.Colors),
                Sizes = (ClothingSize)ci.Sizes,
                Material = ci.Material,
                BusinessIds = ci.Businesses.Select(b => b.BusinessId).ToList()
            }).ToList();

            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public ActionResult<ClothingItemDTO> GetById(int id)
        {
            var item = _service.GetById(id);
            if (item == null) return NotFound();

            var dto = new ClothingItemDTO
            {
                ClothingItemId = item.ClothingItemId,
                Name = item.Name,
                Description = item.Description,
                Price = item.Price,
                Quantity = item.Quantity,
                ClothingCategoryId = item.ClothingCategoryId,
                Brand = item.Brand,
                Model = item.Model,
                PictureUrls = JsonConvert.DeserializeObject<List<string>>(item.PictureUrls),
                Colors = JsonConvert.DeserializeObject<List<string>>(item.Colors),
                Sizes = (ClothingSize)item.Sizes,
                Material = item.Material,
                BusinessIds = item.Businesses.Select(b => b.BusinessId).ToList()
            };

            return Ok(dto);
        }

        [HttpPost]
        [Authorize(Roles = "Employee,Owner")]
        public async Task<ActionResult<ClothingItemDTO>> Post([FromBody] ClothingItemDTO dto)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized("Invalid user-ID claim.");

            await _service.CreateClothingItemAsync(dto, userId);
            return CreatedAtAction(nameof(GetById), new { id = dto.ClothingItemId }, dto);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Employee,Owner")]
        public async Task<IActionResult> Put(int id, [FromBody] ClothingItemDTO dto)
        {
            var existing = _service.GetById(id);
            if (existing == null) return NotFound();

            var bizId = existing.Businesses.Select(b => b.BusinessId).FirstOrDefault();
            if (bizId == 0) return BadRequest("No associated business found.");

            ValidateEmployeeAccess(bizId);

            if (!TryGetUserId(out var userId))
                return Unauthorized("Invalid user-ID claim.");

            dto.ClothingItemId = id;
            await _service.UpdateClothingItemAsync(id, dto, userId);
            await _notificationService.NotifyAsync(userId, "An item was updated.");

            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> Delete(int id)
        {
            var existing = _service.GetById(id);
            if (existing == null) return NotFound();

            var bizId = existing.Businesses.Select(b => b.BusinessId).FirstOrDefault();
            if (bizId == 0) return BadRequest("No associated business found.");

            if (!User.IsInRole("Owner"))
                return Forbid();

            if (!TryGetUserId(out var userId))
                return Unauthorized("Invalid user-ID claim.");

            await _service.DeleteClothingItemAsync(id, userId);
            await _notificationService.NotifyAsync(userId, "An item was deleted.");
            return NoContent();
        }

        [HttpGet("clothingItems/{businessId}/paginated")]
        public async Task<ActionResult<PaginatedResult<ClothingItemDTO>>> GetPaginated(
            int businessId,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            var paginationRequest = new PaginationRequest
            {
                PageNumber = pageNumber,
                PageSize = pageSize
            };

            var result = await _service.GetPaginatedClothingItems(paginationRequest, businessId);
            return Ok(result);
        }

        [HttpGet("clothingItems/{businessId}/grouped")]
        public async Task<ActionResult<GroupByResult<ClothingItemDTO>>> GroupBy(
            int businessId,
            [FromQuery] string key,
            [FromQuery] PaginationRequest paginationRequest)
        {
            if (string.IsNullOrWhiteSpace(key))
                return BadRequest("You must supply a `key` to group by (e.g. ?key=Brand).");

            if (paginationRequest.PageNumber < 1 || paginationRequest.PageSize < 1)
                return BadRequest("Invalid paging parameters.");

            var grouped = await _service.GetGroupByItems(businessId, key, paginationRequest);

            return Ok(grouped);
        }
    }
}
