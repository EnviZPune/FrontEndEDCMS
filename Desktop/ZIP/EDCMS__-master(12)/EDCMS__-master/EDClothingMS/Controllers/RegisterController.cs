using Domain.Aggregates;
using Infrastructure;
using Application.Services;
using BCrypt.Net;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Application.DTOs;

namespace EDClothingMS.Controllers
{
    [ApiController]
    [Route("api/register")]
    public class RegisterController : ControllerBase
    {
        private readonly ClothingStoreDbContext _context;
        private readonly IEmailService _emailService;

        public RegisterController(
            ClothingStoreDbContext context,
            IEmailService emailService)
        {
            _context = context;
            _emailService = emailService;
        }

        [HttpPost]
        public IActionResult Register([FromBody] UserDTO request)
        {
            if (_context.Users.Any(u => u.Email == request.Email))
                return Conflict("Email already in use.");
            var user = new User
            {
                Name = request.Name,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Email = request.Email,
                Role = request.Role.ToString(),
                EmailConfirmed = false,
            };
            _context.Users.Add(user);
            _context.SaveChanges();

            var token = Guid.NewGuid().ToString();
            var ev = new EmailVerification
            {
                UserId = user.UserId,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddDays(1)
            };
            _context.EmailVerifications.Add(ev);
            _context.SaveChanges();

            var verifyUrl = $"{Request.Scheme}://{Request.Host}/api/register/verify?token={token}";
            _emailService.Send(user.Email, "Verify your email", $"Please verify by visiting: {verifyUrl}");
            return Ok();
        }

        [HttpGet("verify")]
        public IActionResult Verify([FromQuery] string token)
        {
            var ev = _context.EmailVerifications.SingleOrDefault(x => x.Token == token);
            if (ev == null || ev.ExpiresAt < DateTime.UtcNow)
                return BadRequest("Invalid or expired token.");
            var user = _context.Users.Find(ev.UserId);
            if (user == null)
                return NotFound();
            user.EmailConfirmed = true;
            _context.EmailVerifications.Remove(ev);
            _context.SaveChanges();
            return Ok("Email verified successfully.");
        }

        [HttpPost("forgot-password")]
        public IActionResult ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            var user = _context.Users.SingleOrDefault(u => u.Email == dto.Email);
            if (user == null) return NotFound();
            var token = Guid.NewGuid().ToString();
            var pr = new PasswordResetToken
            {
                UserId = user.UserId,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddHours(1)
            };
            _context.PasswordResetTokens.Add(pr);
            _context.SaveChanges();
            var resetUrl = $"{Request.Scheme}://{Request.Host}/api/register/reset-password?token={token}";
            _emailService.Send(user.Email, "Reset your password", $"Reset here: {resetUrl}");
            return Ok();
        }

        [HttpPost("reset-password")]
        public IActionResult ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var pr = _context.PasswordResetTokens.SingleOrDefault(x => x.Token == dto.Token);
            if (pr == null || pr.ExpiresAt < DateTime.UtcNow)
                return BadRequest("Invalid or expired token.");
            var user = _context.Users.Find(pr.UserId);
            if (user == null) return NotFound();
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            _context.PasswordResetTokens.Remove(pr);
            _context.SaveChanges();
            return Ok("Password reset successful.");
        }

        public class ForgotPasswordDto { public string Email { get; set; } = string.Empty; }
        public class ResetPasswordDto { public string Token { get; set; } = string.Empty; public string NewPassword { get; set; } = string.Empty; }
    }
}
