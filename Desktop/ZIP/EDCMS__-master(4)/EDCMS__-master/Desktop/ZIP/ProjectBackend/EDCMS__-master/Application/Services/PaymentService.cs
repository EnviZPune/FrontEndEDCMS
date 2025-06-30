using System.Collections.Generic;
using Stripe;
using Stripe.Checkout;
using Microsoft.Extensions.Configuration;

namespace Application.Services
{
    public class PaymentService
    {
        public PaymentService(IConfiguration config)
        {
            StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
        }

        public Session CreateCheckoutSession(int userId, string successUrl, string cancelUrl)
        {
            var options = new SessionCreateOptions
            {
                PaymentMethodTypes = new List<string> { "card" },
                LineItems = new List<SessionLineItemOptions>
                {
                    new SessionLineItemOptions
                    {
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = "usd",
                            UnitAmount = 5000,  // $50.00
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = "Owner Subscription",
                                Description = "Grants Owner role on your next login"
                            }
                        },
                        Quantity = 1
                    }
                },
                Mode = "payment",
                SuccessUrl = successUrl + "?session_id={CHECKOUT_SESSION_ID}",
                CancelUrl = cancelUrl,
                Metadata = new Dictionary<string, string>
                {
                    { "userId", userId.ToString() }
                }
            };

            var service = new SessionService();
            return service.Create(options);
        }
    }
}