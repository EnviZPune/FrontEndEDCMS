using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Domain.Aggregates.Reservation;    // Reservation & ReservationStatus
using Domain.Aggregates;               // BusinessEmployee & User
using Infrastructure;
using Infrastructure.SignalR;
using Application.Services;            // IEmailService

// avoid naming collisions
using DomainReservation       = Domain.Aggregates.Reservation.Reservation;
using DomainReservationStatus = Domain.Aggregates.Reservation.ReservationStatus;

namespace Application.Services
{
    public class ReservationService
    {
        private readonly ClothingStoreDbContext _context;
        private readonly IHubContext<NotificationHub> _hub;
        private readonly IEmailService _emails;

        public ReservationService(
            ClothingStoreDbContext context,
            IHubContext<NotificationHub> hubContext,
            IEmailService emailService)
        {
            _context = context;
            _hub     = hubContext;
            _emails  = emailService;
        }

        /// <summary>
        /// Creates a Pending reservation record (no stock change yet),
        /// then notifies staff (SignalR + email).
        /// </summary>
        public DomainReservation CreateReservation(int clothingItemId, int simpleUserId)
        {
            if (!_context.Users.Any(u => u.UserId == simpleUserId))
                throw new InvalidOperationException("Invalid user ID; user does not exist.");

            var item = _context.ClothingItems
                .FirstOrDefault(ci => ci.ClothingItemId == clothingItemId)
                ?? throw new InvalidOperationException("Invalid item ID; item not found.");

            var res = new DomainReservation
            {
                ClothingItemId = clothingItemId,
                SimpleUserId   = simpleUserId,
                Status         = DomainReservationStatus.Pending,
                CreatedAt      = DateTime.UtcNow
            };

            _context.Reservations.Add(res);
            _context.SaveChanges();

            NotifyStaff(item.Name, res.ReservationId, clothingItemId);
            return res;
        }

        /// <summary>
        /// Updates the status: on Pending→Confirmed, decrements stock;
        /// on other transitions, just update. Always notifies customer.
        /// </summary>
        public bool UpdateReservationStatus(int reservationId, DomainReservationStatus newStatus)
        {
            var resv = _context.Reservations
                .Include(r => r.ClothingItem)
                .Include(r => r.SimpleUser)
                .FirstOrDefault(r => r.ReservationId == reservationId);
            if (resv == null) return false;

            if (resv.Status == DomainReservationStatus.Pending
                && newStatus == DomainReservationStatus.Confirmed)
            {
                var item = resv.ClothingItem;
                if (item.Quantity <= 0)
                    throw new InvalidOperationException("Out of stock.");
                item.Quantity--;
            }

            resv.Status = newStatus;
            _context.SaveChanges();

            NotifyCustomer(resv.SimpleUser, resv.ClothingItem.Name, reservationId, newStatus);
            return true;
        }

        /// <summary>
        /// Marks a reservation Completed.
        /// </summary>
        public bool CompleteReservation(int reservationId)
            => UpdateReservationStatus(reservationId, DomainReservationStatus.Completed);

        /// <summary>
        /// Returns detailed info for one reservation.
        /// </summary>
        public ReservationDetailsDTO? GetByIdDetailed(int reservationId)
        {
            var r = _context.Reservations
                .Include(x => x.ClothingItem).ThenInclude(ci => ci.Businesses)
                .Include(x => x.SimpleUser)
                .FirstOrDefault(x => x.ReservationId == reservationId);
            if (r == null) return null;

            return new ReservationDetailsDTO
            {
                ReservationId = r.ReservationId,
                ProductName   = r.ClothingItem.Name,
                ShopName      = r.ClothingItem.Businesses.FirstOrDefault()?.Name ?? "",
                CustomerName  = r.SimpleUser.Name,
                CreatedAt     = r.CreatedAt,
                Status        = r.Status
            };
        }

        /// <summary>
        /// Returns detailed info for all reservations of a business.
        /// </summary>
        public List<ReservationDetailsDTO> GetForBusinessDetailed(int businessId)
            => _context.Reservations
                .Include(r => r.ClothingItem).ThenInclude(ci => ci.Businesses)
                .Include(r => r.SimpleUser)
                .Where(r => r.ClothingItem.Businesses.Any(b => b.BusinessId == businessId))
                .AsEnumerable()
                .Select(r => new ReservationDetailsDTO
                {
                    ReservationId = r.ReservationId,
                    ProductName   = r.ClothingItem.Name,
                    ShopName      = r.ClothingItem.Businesses.First().Name,
                    CustomerName  = r.SimpleUser.Name,
                    CreatedAt     = r.CreatedAt,
                    Status        = r.Status
                })
                .ToList();

        private void NotifyStaff(string itemName, int resId, int itemId)
        {
            var businessIds = _context.Businesses
                .Where(b => b.ClothingItems.Any(ci => ci.ClothingItemId == itemId))
                .Select(b => b.BusinessId)
                .ToList();

            var staff = _context.BusinessEmployees
                .Include(be => be.User)
                .Where(be => be.IsApproved && businessIds.Contains(be.BusinessId))
                .ToList();

            var seen = new HashSet<int>();
            foreach (var be in staff)
            {
                var u = be.User;
                if (!seen.Add(u.UserId)) continue;
                var msg = $"New reservation #{resId} for \"{itemName}\"";

                _hub.Clients.User(u.UserId.ToString())
                    .SendAsync("ReceiveNotification", msg);
                _emails.Send(u.Email, "New Reservation", msg);
            }
        }

        private void NotifyCustomer(User user, string itemName, int resId, DomainReservationStatus status)
        {
            var subject = status switch
            {
                DomainReservationStatus.Confirmed => "Your reservation is confirmed",
                DomainReservationStatus.Cancelled => "Your reservation was cancelled",
                DomainReservationStatus.Completed => "Your reservation is complete",
                _                                  => "Your reservation status changed"
            };
            var body = $"{subject}\nProduct: {itemName}\nReservation ID: {resId}";

            _hub.Clients.User(user.UserId.ToString())
                .SendAsync("ReceiveNotification", body);
            _emails.Send(user.Email, subject, body);
        }
    }

    public class ReservationDetailsDTO
    {
        public int ReservationId   { get; set; }
        public string ProductName  { get; set; } = "";
        public string ShopName     { get; set; } = "";
        public string CustomerName { get; set; } = "";
        public DateTime CreatedAt  { get; set; }
        public DomainReservationStatus Status { get; set; }
    }
}
