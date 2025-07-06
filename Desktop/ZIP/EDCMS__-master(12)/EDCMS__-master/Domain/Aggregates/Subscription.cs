using System;

namespace Domain.Aggregates
{
    public class Subscription
    {
        public int      Id                     { get; set; }
        public int      UserId                 { get; set; }
        public string   StripeSubscriptionId   { get; set; } = string.Empty;
        public DateTime ExpiresAt              { get; set; }
    }
}