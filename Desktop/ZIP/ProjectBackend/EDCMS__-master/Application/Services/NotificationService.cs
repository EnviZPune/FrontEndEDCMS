using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Domain.Aggregates;
using Infrastructure;
using Infrastructure.SignalR;
using Microsoft.AspNetCore.SignalR;

namespace Application.Services
{
    public interface INotificationService
    {
        Task NotifyAsync(int userId, string message);
        IEnumerable<Notification> GetNotifications(int userId);
        void MarkAsRead(int notificationId, int userId);
        
        void ClearAll(int userId);
    }

    public class NotificationService : INotificationService
    {
        private readonly ClothingStoreDbContext _db;
        private readonly IHubContext<NotificationHub> _hub;

        public NotificationService(ClothingStoreDbContext db, IHubContext<NotificationHub> hub)
        {
            _db = db;
            _hub = hub;
        }

        public async Task NotifyAsync(int userId, string message)
        {
            var note = new Notification
            {
                UserId    = userId,
                Message   = message,
                CreatedAt = DateTime.UtcNow
            };
            _db.Notifications.Add(note);
            await _db.SaveChangesAsync();

            await _hub.Clients.User(userId.ToString())
                   .SendAsync("ReceiveNotification", new
                   {
                       note.Id,
                       note.Message,
                       note.CreatedAt
                   });
        }

        public IEnumerable<Notification> GetNotifications(int userId)
        {
            return _db.Notifications
                      .Where(n => n.UserId == userId)
                      .OrderByDescending(n => n.CreatedAt)
                      .ToList();
        }

        public void MarkAsRead(int notificationId, int userId)
        {
            var note = _db.Notifications
                          .SingleOrDefault(n => n.Id == notificationId && n.UserId == userId);
            if (note != null)
            {
                note.IsRead = true;
                _db.SaveChanges();
            }
        }

        public void ClearAll(int userId)
        {
            var notes = _db.Notifications
                           .Where(n => n.UserId == userId);
            _db.Notifications.RemoveRange(notes);
            _db.SaveChanges();
        }
    }
}
