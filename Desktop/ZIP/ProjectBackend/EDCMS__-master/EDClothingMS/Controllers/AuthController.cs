using Microsoft.AspNetCore.Mvc;
using Infrastructure;     
using Application.Services;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
  private readonly ClothingStoreDbContext _db;
  private readonly IEmailService _email;

  public AuthController(ClothingStoreDbContext db, IEmailService email)
  {
    _db = db;
    _email = email;
  }

  [HttpPost("send-confirmation")]
  public IActionResult SendConfirmation([FromBody] SendConfirmationRequest req)
  {
    var user = _db.Users.SingleOrDefault(u => u.Email == req.Email);
    if (user == null) return NotFound("No account for that email.");

    user.EmailConfirmationToken = Guid.NewGuid().ToString();
    user.EmailConfirmationSentAt = DateTime.UtcNow;
    _db.SaveChanges();

    var link = $"{req.ClientUrl}/confirm-email?userId={user.UserId}&token={user.EmailConfirmationToken}";
    _email.Send(user.Email, "Confirm your email", $"Click here to confirm: {link}");

    return Ok("Confirmation email sent.");
  }

  [HttpGet("confirm-email")]
  public IActionResult ConfirmEmail(int userId, string token)
  {
    var user = _db.Users.Find(userId);
    if (user == null) return NotFound();
    if (user.EmailConfirmed) return BadRequest("Already confirmed.");
    if (user.EmailConfirmationToken != token
        || user.EmailConfirmationSentAt < DateTime.UtcNow.AddHours(-24))
      return BadRequest("Invalid or expired token.");

    user.EmailConfirmed = true;
    user.EmailConfirmationToken = null;
    user.EmailConfirmationSentAt = null;
    _db.SaveChanges();

    return Ok("Email confirmed.");
  }


  [HttpPost("forgot-password")]
  public IActionResult ForgotPassword([FromBody] ForgotPasswordRequest req)
  {
    var user = _db.Users.SingleOrDefault(u => u.Email == req.Email);
    if (user == null) return NotFound();

    user.PasswordResetToken = Guid.NewGuid().ToString();
    user.PasswordResetSentAt = DateTime.UtcNow;
    _db.SaveChanges();

    var link = $"{req.ClientUrl}/reset-password?userId={user.UserId}&token={user.PasswordResetToken}";
    _email.Send(user.Email, "Reset your password", $"Click here to reset: {link}");

    return Ok("Password reset email sent.");
  }


  [HttpPost("reset-password")]
  public IActionResult ResetPassword([FromBody] ResetPasswordRequest req)
  {
    var user = _db.Users.Find(req.UserId);
    if (user == null) return NotFound();
    if (user.PasswordResetToken != req.Token
        || user.PasswordResetSentAt < DateTime.UtcNow.AddHours(-2))
      return BadRequest("Invalid or expired token.");

    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
    user.PasswordResetToken = null;
    user.PasswordResetSentAt = null;
    _db.SaveChanges();

    return Ok("Password has been reset.");
  }
}

public class SendConfirmationRequest
{
  public string Email { get; set; }
  public string ClientUrl { get; set; }    
}
public class ForgotPasswordRequest
{
  public string Email { get; set; }
  public string ClientUrl { get; set; }
}
public class ResetPasswordRequest
{
  public int UserId { get; set; }
  public string Token { get; set; }
  public string NewPassword { get; set; }
}
