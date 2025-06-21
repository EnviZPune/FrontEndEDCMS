using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;


namespace Infrastructure.SignalR
{
    [Authorize] // Enforce authorization globally for all hub methods
    public class NotificationHub : Hub
    {
        /// <summary>
        /// Sends a notification to all connected clients.
        /// </summary>
        /// <param name="message">The notification message.</param>
        public async Task SendNotification(string message)
        {
            await Clients.All.SendAsync("ReceiveNotification", message);
        }

        /// <summary>
        /// Sends a notification to all users with a specific role.
        /// </summary>
        /// <param name="role">The role to target (e.g., "Owner", "Employee").</param>
        /// <param name="message">The notification message.</param>
        public async Task SendNotificationToRole(string role, string message)
        {
            if (IsValidRole(role)) // Validate role before sending
            {
                await Clients.Group(role).SendAsync("ReceiveNotification", message);
            }
        }

        /// <summary>
        /// Sends a notification to a specific user.
        /// </summary>
        /// <param name="userId">The user ID to target.</param>
        /// <param name="message">The notification message.</param>
        public async Task SendNotificationToUser(string userId, string message)
        {
            await Clients.User(userId).SendAsync("ReceiveNotification", message);
        }

        /// <summary>
        /// Handles ProposedChangeReviewedEvent and sends notifications accordingly.
        /// </summary>
        /// <param name="employeeId">ID of the employee whose proposed change was reviewed.</param>
        /// <param name="approved">Whether the change was approved or rejected.</param>
        /// <param name="details">Details of the proposed change.</param>
        public async Task HandleProposedChangeReviewed(int employeeId, bool approved, string details)
        {
            var message = approved ? "Your proposed change has been approved." : "Your proposed change was rejected: " + details;
            await Clients.User(employeeId.ToString()).SendAsync("ReceiveNotification", message);
        }

        /// <summary>
        /// Adds a connection to a role-based group for targeted notifications.
        /// </summary>
        /// <param name="role">The role to assign this connection to.</param>
        public async Task JoinRoleGroup(string role)
        {
            if (IsValidRole(role)) // Validate role before adding to group
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, role);
            }
        }

        /// <summary>
        /// Removes a connection from a role-based group.
        /// </summary>
        /// <param name="role">The role to remove this connection from.</param>
        public async Task LeaveRoleGroup(string role)
        {
            if (IsValidRole(role)) // Validate role before removing from group
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, role);
            }
        }

        /// <summary>
        /// Validates the role before performing group operations.
        /// </summary>
        /// <param name="role">The role to validate.</param>
        /// <returns>True if the role is valid, otherwise false.</returns>
        private bool IsValidRole(string role)
        {
            var validRoles = new[] { "Owner", "Employee" };
            return validRoles.Contains(role);
        }
    }
}
