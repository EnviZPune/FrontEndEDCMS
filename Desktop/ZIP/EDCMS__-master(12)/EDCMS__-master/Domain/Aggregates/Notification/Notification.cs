using System;

namespace Domain.Aggregates
{
    public class Notification
    {
        public int      Id          { get; set; }
        public int      UserId      { get; set; }
        public int?     BusinessId  { get; set; }   
        public string   Message     { get; set; }
        public DateTime CreatedAt   { get; set; }
        public bool     IsRead      { get; set; } = false;
        public bool     IsDismissed { get; set; } = false;
    }
}
