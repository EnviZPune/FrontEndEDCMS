using Infrastructure;
using Infrastructure.SignalR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using Domain.Aggregates.Reservation;

namespace Application.Services
{
    public class ReservationService
    {
        private readonly ClothingStoreDbContext _context;
        private readonly IHubContext<NotificationHub> _hubContext;

        public ReservationService(ClothingStoreDbContext context, IHubContext<NotificationHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public Reservation CreateReservation(ReservationDTO dto)
        {
            var reservation = new Reservation
            {
                ClothingItemId = dto.ClothingItemId,
                SimpleUserId = dto.SimpleUserId,
                Status = (Domain.Aggregates.Reservation.ReservationStatus)dto.Status,
                CreatedAt = DateTime.UtcNow
            };

            _context.Reservations.Add(reservation);
            _context.SaveChanges();

            var clothingItem = _context.ClothingItems
                .Include(ci => ci.Businesses)
                    .ThenInclude(b => b.Owners)
                .FirstOrDefault(ci => ci.ClothingItemId == dto.ClothingItemId);
            if (clothingItem != null)
            {
                foreach (var business in clothingItem.Businesses)
                {
                    foreach (var owner in business.Owners)
                    {
                        _hubContext.Clients.User(owner.UserId.ToString())
                            .SendAsync("ReceiveNotification", "A new reservation has been made for your item.");
                    }
                }
            }

            return reservation;
        }

        public bool UpdateReservationStatus(int reservationId, Domain.Aggregates.Reservation.ReservationStatus newStatus)
        {
            var reservation = _context.Reservations.FirstOrDefault(r => r.ReservationId == reservationId);
            if (reservation == null)
                return false;

            reservation.Status = newStatus;
            _context.SaveChanges();

            var message = newStatus switch
            {
                Domain.Aggregates.Reservation.ReservationStatus.Confirmed => "Your reservation has been confirmed.",
                Domain.Aggregates.Reservation.ReservationStatus.Cancelled => "Your reservation has been cancelled.",
                _ => "Your reservation status has been updated."
            };

            _hubContext.Clients.User(reservation.SimpleUserId.ToString())
                .SendAsync("ReceiveNotification", message);

            return true;
        }
        
        public Reservation? GetById(int reservationId)
        {
            return _context.Reservations
                .Include(r => r.ClothingItem)
                .Include(r => r.SimpleUser)
                .FirstOrDefault(r => r.ReservationId == reservationId);
        }
    }
}
