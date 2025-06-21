using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Application.Services;
using Infrastructure;
using Stripe;
using Stripe.Checkout;

namespace EDClothingMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentController : ControllerBase
    {
        private readonly PaymentService _paymentService;
        private readonly IConfiguration _config;
        private readonly ClothingStoreDbContext _db;

        public PaymentController(
            PaymentService paymentService,
            IConfiguration config,
            ClothingStoreDbContext db)
        {
            _paymentService = paymentService;
            _config = config;
            _db = db;
        }

        [HttpPost("create-session")]
        [Authorize]  
        public IActionResult CreateCheckout([FromQuery] string successUrl, [FromQuery] string cancelUrl)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var session = _paymentService.CreateCheckoutSession(userId, successUrl, cancelUrl);
            return Ok(new { sessionId = session.Id });
        }

        [HttpPost("webhook")]
        [AllowAnonymous]
        public async Task<IActionResult> Webhook()
        {
            var json = await new StreamReader(Request.Body).ReadToEndAsync();
            var signature = Request.Headers["Stripe-Signature"];
            Event stripeEvent;

            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    json,
                    signature,
                    _config["Stripe:WebhookSecret"]
                );
            }
            catch
            {
                return BadRequest();
            }

            if (stripeEvent.Type == EventTypes.CheckoutSessionCompleted)
            {
                var session = stripeEvent.Data.Object as Session;
                var userId = int.Parse(session!.Metadata["userId"]);

                var user = await _db.Users.FindAsync(userId);
                if (user != null)
                {
                    user.Role = "Owner";
                    await _db.SaveChangesAsync();
                }
            }

            return Ok();
        }
    }
}
