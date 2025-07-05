using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Application.Services;
using Stripe.Checkout;

namespace EDClothingMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentController : ControllerBase
    {
        private readonly PaymentService _payments;

        public PaymentController(PaymentService payments) => _payments = payments;

        [HttpPost("create-session")]
        [Authorize]
        public async Task<IActionResult> CreateSession(
            [FromQuery] string successUrl,
            [FromQuery] string cancelUrl)
        {
            var userId  = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var session = await _payments.CreateCheckoutSessionAsync(userId, successUrl, cancelUrl);
            return Ok(new { url = session.Url });
        }

        [HttpPost("webhook")]
        [AllowAnonymous]
        public async Task<IActionResult> Webhook()
        {
            await _payments.HandleWebhookAsync(Request);
            return Ok();
        }
    }
}