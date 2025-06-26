using Microsoft.AspNetCore.Mvc;
using Application.Services;
using Application.DTOs;
using Microsoft.AspNetCore.Authorization;

namespace EDClothingMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Owner")]
    public class ApprovalController : ControllerBase
    {
        private readonly ApprovalService _approvalService;

        public ApprovalController(ApprovalService approvalService)
        {
            _approvalService = approvalService;
        }

        [HttpGet]
        public IActionResult GetAll()
        {
            var approvals = _approvalService.GetAll(User);
            return Ok(approvals);
        }

        [HttpGet("{id:int}")]
        public IActionResult GetById(int id)
        {
            var approval = _approvalService.GetById(id, User);
            if (approval == null)
            {
                return NotFound();
            }
            return Ok(approval);
        }

        [HttpDelete("{id:int}")]
        public IActionResult Delete(int id)
        {
            var success = _approvalService.DeleteApproval(id, User);
            if (!success)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}
