using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Domain.Aggregates;  
using Infrastructure;                       
using Application.Services;                 
using Microsoft.Extensions.Configuration;

namespace Application.Services
{
    public class PasswordResetService
    {
        private readonly ClothingStoreDbContext _db;
        private readonly IEmailService _email;
        private readonly IConfiguration _config;

        public PasswordResetService(
            ClothingStoreDbContext db,
            IEmailService email,
            IConfiguration config)
        {
            _db = db;
            _email = email;
            _config = config;
        }

        public async Task GenerateResetTokenAsync(string email)
        {
            var user = await _db.Users.SingleOrDefaultAsync(u => u.Email == email);
            if (user == null) return;

            var reset = new PasswordResetToken
            {
                UserId = user.UserId,
                Token = Guid.NewGuid().ToString(),
                ExpiresAt = DateTime.UtcNow.AddHours(1)
            };

            _db.PasswordResetTokens.Add(reset);
            await _db.SaveChangesAsync();

            var frontendUrl = _config["AppSettings:FrontendUrl"];
            var link = $"{frontendUrl}/reset-password?token={reset.Token}";

            _email.Send(
                user.Email,
                "Reset your password",
                $"<p>Click <a href=\"{link}\">here</a> to reset your password. Expires in 1 hour.</p>"
            );
        }

        public async Task<bool> ResetPasswordAsync(string token, string newPassword)
        {
            var entry = await _db.PasswordResetTokens
                .Include(r => r.User)
                .SingleOrDefaultAsync(r =>
                    r.Token == token &&
                    r.ExpiresAt > DateTime.UtcNow);

            if (entry == null) return false;

            entry.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);

            _db.PasswordResetTokens.Remove(entry);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
