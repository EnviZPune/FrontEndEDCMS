using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Application.Services;
using Application.DTOs;

namespace EDClothingMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationController : ControllerBase
    {
        private readonly INotificationService _svc;

        public NotificationController(INotificationService svc)
        {
            _svc = svc;
        }

        [HttpGet]
        public async Task<IActionResult> GetUserNotificationsAsync()
        {
            var userId = int.Parse(User.FindFirst("UserId")!.Value);
            var notes = await _svc.GetUserNotificationsAsync(userId);
            var active = notes
                .Where(n => !n.IsDismissed)
                .OrderByDescending(n => n.CreatedAt);
            return Ok(active);
        }

        [HttpPut("{id:int}/read")]
        public async Task<IActionResult> MarkReadAsync(int id)
        {
            var userId = int.Parse(User.FindFirst("UserId")!.Value);
            await _svc.MarkAsReadAsync(id, userId);
            return NoContent();
        }
        
        [HttpDelete]
        public async Task<IActionResult> ClearAllAsync()
        {
            var userId = int.Parse(User.FindFirst("UserId")!.Value);
            await _svc.ClearAllAsync(userId);   
            return NoContent();
        }


        [HttpGet("business/{businessId}/history")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> GetBusinessHistoryAsync(int businessId)
        {
            var ownerUserId = int.Parse(User.FindFirst("UserId")!.Value);
            var all = await _svc.GetBusinessHistoryAsync(businessId, ownerUserId);
            var history = all
                .Where(n =>
                    n.Message.Contains("item", StringComparison.OrdinalIgnoreCase)
                    || n.Message.Contains("business info", StringComparison.OrdinalIgnoreCase)
                )
                .OrderByDescending(n => n.CreatedAt);
            return Ok(history);
        }
    }
}
