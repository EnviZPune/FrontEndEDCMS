using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Stripe;
using Stripe.Checkout;
using Infrastructure;
using DomainIntent       = Domain.Aggregates.PaymentIntent;
using DomainSubscription = Domain.Aggregates.Subscription;
using DomainOneTimeToken = Domain.Aggregates.OneTimeToken;

namespace Application.Services
{
    public class PaymentService
    {
        private readonly IConfiguration          _config;
        private readonly ClothingStoreDbContext _db;
        private readonly IEmailService          _email;

        public PaymentService(
            IConfiguration config,
            ClothingStoreDbContext db,
            IEmailService email)
        {
            _config = config;
            _db     = db;
            _email  = email;
            StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];
        }

        public async Task<Session> CreateCheckoutSessionAsync(
            int userId,
            string successUrl,
            string cancelUrl)
        {
            var lineItem = new SessionLineItemOptions
            {
                PriceData = new SessionLineItemPriceDataOptions
                {
                    Currency   = "usd",
                    UnitAmount = 5000,
                    Recurring  = new SessionLineItemPriceDataRecurringOptions { Interval = "month" },
                    ProductData = new SessionLineItemPriceDataProductDataOptions
                    {
                        Name        = "Owner Subscription",
                        Description = "Grants Owner role on your next login"
                    }
                },
                Quantity = 1
            };

            var options = new SessionCreateOptions
            {
                PaymentMethodTypes = new List<string> { "card" },
                Mode               = "subscription",
                LineItems          = new List<SessionLineItemOptions> { lineItem },
                SuccessUrl         = $"{successUrl}?session_id={{CHECKOUT_SESSION_ID}}",
                CancelUrl          = cancelUrl,
                Metadata           = new Dictionary<string, string> { ["userId"] = userId.ToString() }
            };

            var session = await new SessionService().CreateAsync(options);

            _db.PaymentIntents.Add(new DomainIntent
            {
                SessionId = session.Id,
                UserId    = userId,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();

            return session;
        }

        public async Task HandleWebhookAsync(HttpRequest request)
        {
            var json = await new StreamReader(request.Body).ReadToEndAsync();
            var stripeEvent = EventUtility.ConstructEvent(
                json,
                request.Headers["Stripe-Signature"],
                _config["Stripe:WebhookSecret"]);

            if (stripeEvent.Type == "checkout.session.completed")
            {
                var session = stripeEvent.Data.Object as Session;
                var intent  = _db.PaymentIntents.Single(pi => pi.SessionId == session.Id);
                var userId  = intent.UserId;

                var sub = _db.Subscriptions.SingleOrDefault(s => s.UserId == userId);
                if (sub == null)
                {
                    _db.Subscriptions.Add(new DomainSubscription
                    {
                        UserId               = userId,
                        StripeSubscriptionId = session.SubscriptionId!,
                        ExpiresAt            = DateTime.UtcNow.AddMonths(1)
                    });
                }
                else
                {
                    sub.ExpiresAt = DateTime.UtcNow.AddMonths(1);
                }

                var token = Guid.NewGuid().ToString();
                _db.OneTimeTokens.Add(new DomainOneTimeToken
                {
                    UserId    = userId,
                    Token     = token,
                    ExpiresAt = DateTime.UtcNow.AddHours(24)
                });
                await _db.SaveChangesAsync();

                var baseUrl = _config["App:BaseUrl"].TrimEnd('/');
                var link    = $"{baseUrl}/owner-form?token={token}";
                var user    = await _db.Users.FindAsync(userId);
                if (user != null)
                {
                    _email.Send(
                        to:      user.Email,
                        subject: "Complete Your Owner Registration",
                        body:    $"Thank you for subscribing! Finish here:\n\n{link}"
                    );
                }
            }
            else if (stripeEvent.Type == "invoice.payment_succeeded")
            {
                var invoice = stripeEvent.Data.Object as Invoice;
                var lineItem = invoice.Lines.Data
                                  .OfType<InvoiceLineItem>()
                                  .FirstOrDefault(li => li.SubscriptionId != null);
                if (lineItem != null)
                {
                    var subscriptionId = lineItem.SubscriptionId!;
                    var expiresAt      = lineItem.Period.End.ToUniversalTime();

                    var sub = _db.Subscriptions
                                 .SingleOrDefault(s => s.StripeSubscriptionId == subscriptionId);
                    if (sub != null)
                    {
                        sub.ExpiresAt = expiresAt;
                        await _db.SaveChangesAsync();
                    }
                }
            }
        }

        public Task<bool> HasActiveSubscriptionAsync(int userId)
        {
            var active = _db.Subscriptions
                            .Any(s => s.UserId == userId && s.ExpiresAt > DateTime.UtcNow);
            return Task.FromResult(active);
        }
    }
}
