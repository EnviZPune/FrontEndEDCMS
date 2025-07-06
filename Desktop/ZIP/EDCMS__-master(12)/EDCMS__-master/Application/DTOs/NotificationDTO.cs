using System;
using System.ComponentModel.DataAnnotations;

public class NotificationDTO
{
    public int NotificationId { get; set; }

    [Required]
    public int UserId { get; set; }

    public int? BusinessId { get; set; }

    [Required, StringLength(250)]
    public string Message { get; set; }

    [Required]
    public NotificationType NotificationType { get; set; }

    public bool IsRead { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum NotificationType
{
    ApprovalRequest,
    Reservation
}
