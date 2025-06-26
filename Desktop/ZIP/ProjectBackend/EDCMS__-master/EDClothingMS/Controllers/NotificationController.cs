using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Application.Services;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationController : ControllerBase
{
    private readonly INotificationService _svc;
    public NotificationController(INotificationService svc) => _svc = svc;

    [HttpGet]
    public IActionResult GetAll()
    {
        var userId = int.Parse(User.FindFirst("UserId").Value);
        var notes = _svc.GetNotifications(userId);
        return Ok(notes);
    }

    [HttpPut("{id:int}/read")]
    public IActionResult MarkRead(int id)
    {
        var userId = int.Parse(User.FindFirst("UserId").Value);
        _svc.MarkAsRead(id, userId);
        return NoContent();
    }

    [HttpDelete]
    public IActionResult ClearAll()
    {
        var userId = int.Parse(User.FindFirst("UserId").Value);
        _svc.ClearAll(userId);
        return NoContent();
    }
}
