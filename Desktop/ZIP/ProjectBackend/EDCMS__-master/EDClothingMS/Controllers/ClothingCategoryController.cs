using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Application.DTOs;
using Domain.Aggregates;
using Infrastructure;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ClothingCategoryController : ControllerBase
    {
        private readonly ClothingStoreDbContext _context;

        public ClothingCategoryController(ClothingStoreDbContext context)
        {
            _context = context;
        }

        [HttpGet("business/{businessId}")]
        public async Task<ActionResult<List<ClothingCategoryDTO>>> GetForBusiness(int businessId)
        {
            var categories = await _context.ClothingCategories
                .Where(c => c.BusinessId == businessId)
                .Select(c => new ClothingCategoryDTO
                {
                    ClothingCategoryId = c.ClothingCategoryId,
                    Name = c.Name,
                    Color = c.Color,
                    Icon = c.Icon,
                    BusinessId = c.BusinessId
                })
                .ToListAsync();

            return Ok(categories);
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] ClothingCategoryDTO dto)
        {
            if (dto == null)
                return BadRequest("Category data is required.");

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var businessExists = await _context.Businesses.AnyAsync(b => b.BusinessId == dto.BusinessId);
            if (!businessExists)
                return NotFound($"Business with ID {dto.BusinessId} not found.");

            var category = new ClothingCategory
            {
                Name = dto.Name,
                Color = dto.Color,
                Icon = dto.Icon,
                BusinessId = dto.BusinessId
            };

            _context.ClothingCategories.Add(category);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Category created successfully." });
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, [FromBody] ClothingCategoryDTO dto)
        {
            if (dto == null)
                return BadRequest("Category update data is required.");

            var category = await _context.ClothingCategories.FindAsync(id);
            if (category == null)
                return NotFound($"Category with ID {id} not found.");

            category.Name = dto.Name;
            category.Color = dto.Color;
            category.Icon = dto.Icon;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Category updated successfully." });
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var category = await _context.ClothingCategories.FindAsync(id);
            if (category == null)
                return NotFound($"Category with ID {id} not found.");

            _context.ClothingCategories.Remove(category);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Category deleted successfully." });
        }
    }
}
