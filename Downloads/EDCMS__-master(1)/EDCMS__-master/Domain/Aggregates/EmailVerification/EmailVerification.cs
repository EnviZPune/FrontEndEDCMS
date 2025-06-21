namespace Domain.Aggregates
{
    public class EmailVerification
    {
        public int EmailVerificationId { get; set; }
        public int UserId { get; set; }
        public string Token { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public User User { get; set; } = null!;
    }
}
