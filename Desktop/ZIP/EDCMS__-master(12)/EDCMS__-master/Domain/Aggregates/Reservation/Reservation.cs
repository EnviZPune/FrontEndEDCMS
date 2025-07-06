using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Domain.Aggregates.Reservation
{
    public enum ReservationStatus
    {
        Pending,
        Confirmed,
        Cancelled,
        Completed
    }

    public class Reservation
    {
        public int ReservationId   { get; set; }
        public int ClothingItemId  { get; set; }
        public int SimpleUserId    { get; set; }
        public ReservationStatus Status      { get; set; } = ReservationStatus.Pending;
        public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;

        [NotMapped]
        public DateTime? UpdatedAt { get; set; }

        public ClothingItem ClothingItem { get; set; } = null!;
        public User           SimpleUser   { get; set; } = null!;
    }
}
