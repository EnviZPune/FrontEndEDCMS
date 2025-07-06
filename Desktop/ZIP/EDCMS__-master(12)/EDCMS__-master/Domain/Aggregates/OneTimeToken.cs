using System;

namespace Domain.Aggregates
{
    public class OneTimeToken
    {
        public int      Id        { get; set; }
        public int      UserId    { get; set; }
        public string   Token     { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
    }
}