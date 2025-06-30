using System.ComponentModel.DataAnnotations;
using System;

public class ReservationDTO
{
    public int ReservationId { get; set; }

    [Required]
    public int ClothingItemId { get; set; }

    [Required]
    public int SimpleUserId { get; set; }

    [Required]
    public ReservationStatus Status { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}

public enum ReservationStatus
{
    Pending,
    Confirmed,
    Cancelled
}