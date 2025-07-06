using System;

namespace Domain.Aggregates
{
    public class PaymentIntent
    {
        public int      Id         { get; set; }
        public string   SessionId  { get; set; } = string.Empty;
        public int      UserId     { get; set; }
        public DateTime CreatedAt  { get; set; }
    }
}