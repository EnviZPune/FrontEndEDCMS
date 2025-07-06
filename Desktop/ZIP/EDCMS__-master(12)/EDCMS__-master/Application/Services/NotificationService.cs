using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Domain.Aggregates;
using Infrastructure;
using Infrastructure.SignalR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Application.Services
{
    public interface INotificationService
    {
        Task NotifyAsync(int userId, string message, int? businessId = null);
        Task<IEnumerable<Notification>> GetUserNotificationsAsync(int userId);
        Task MarkAsReadAsync(int notificationId, int userId);
        Task ClearAllAsync(int userId);  // now soft‐dismisses instead of deleting
        Task<IEnumerable<NotificationDTO>> GetBusinessHistoryAsync(int businessId, int ownerUserId);
    }

    public class NotificationService : INotificationService
    {
        private readonly ClothingStoreDbContext _db;
        private readonly IHubContext<NotificationHub> _hub;

        public NotificationService(ClothingStoreDbContext db, IHubContext<NotificationHub> hub)
        {
            _db  = db;
            _hub = hub;
        }

        public async Task NotifyAsync(int userId, string message, int? businessId = null)
        {
            var note = new Notification
            {
                UserId      = userId,
                BusinessId  = businessId,
                Message     = message,
                CreatedAt   = DateTime.UtcNow,
                IsRead      = false,
                IsDismissed = false                        // default to active
            };

            _db.Notifications.Add(note);
            await _db.SaveChangesAsync();

            await _hub.Clients
                      .User(userId.ToString())
                      .SendAsync("ReceiveNotification", new
                      {
                          note.Id,
                          note.Message,
                          note.CreatedAt,
                          note.BusinessId
                      });
        }

        public async Task<IEnumerable<Notification>> GetUserNotificationsAsync(int userId)
        {
            return await _db.Notifications
                            .Where(n => n.UserId == userId)
                            .OrderByDescending(n => n.CreatedAt)
                            .ToListAsync();
        }

        public async Task MarkAsReadAsync(int notificationId, int userId)
        {
            var note = await _db.Notifications
                                .SingleOrDefaultAsync(n =>
                                    n.Id     == notificationId &&
                                    n.UserId == userId);
            if (note != null)
            {
                note.IsRead = true;
                await _db.SaveChangesAsync();
            }
        }

        public async Task ClearAllAsync(int userId)
        {
            var notes = await _db.Notifications
                                 .Where(n => n.UserId == userId && !n.IsDismissed)
                                 .ToListAsync();
            foreach (var n in notes)
                n.IsDismissed = true;
            await _db.SaveChangesAsync();
        }

        public async Task<IEnumerable<NotificationDTO>> GetBusinessHistoryAsync(int businessId, int ownerUserId)
        {
            return await _db.Notifications
                .Where(n => n.BusinessId == businessId)
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new NotificationDTO
                {
                    NotificationId   = n.Id,
                    UserId           = n.UserId,
                    BusinessId       = n.BusinessId,
                    Message          = n.Message,
                    IsRead           = n.IsRead,
                    CreatedAt        = n.CreatedAt
                })
                .ToListAsync();
        }
    }
}
