using System;
using System.Linq;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;                // for DbUpdateException
using Application.Services;
using Domain.Aggregates.Reservation;                 // ReservationStatus
using DomainReservationStatus = Domain.Aggregates.Reservation.ReservationStatus;

namespace EDClothingMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]   // any signed-in user may POST
    public class ReservationController : ControllerBase
    {
        private readonly ReservationService _reservationService;

        public ReservationController(ReservationService reservationService)
            => _reservationService = reservationService;

        // POST /api/Reservation
        [HttpPost]
        public IActionResult Create([FromBody] CreateReservationRequest req)
        {
            var userIdClaim =
                   User.FindFirst("UserId")
                ?? User.FindFirst(ClaimTypes.NameIdentifier)
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)
                ?? User.FindFirst("id")
                ?? User.FindFirst("userId")
                ?? User.FindFirst(ClaimTypes.Name);

            if (userIdClaim == null 
                || !int.TryParse(userIdClaim.Value, out var userId))
            {
                return Unauthorized("Invalid or missing user ID claim.");
            }

            try
            {
                var reservation = _reservationService.CreateReservation(
                    req.ClothingItemId,
                    userId
                );
                return CreatedAtAction(
                    nameof(GetByIdDetailed),
                    new { id = reservation.ReservationId },
                    reservation
                );
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (DbUpdateException dbEx)
            {
                var msg = dbEx.InnerException?.Message ?? dbEx.Message;
                return BadRequest("Database error: " + msg);
            }
        }

        // GET /api/Reservation/claims
        [HttpGet("claims")]
        public IActionResult ShowClaims()
            => Ok(User.Claims.Select(c => new { c.Type, c.Value }));

        // GET /api/Reservation/{id}/details
        [HttpGet("{id}/details")]
        public IActionResult GetByIdDetailed(int id)
        {
            var dto = _reservationService.GetByIdDetailed(id);
            return dto == null ? NotFound() : Ok(dto);
        }

        // GET /api/Reservation/business/{businessId}
        [HttpGet("business/{businessId}")]
        [Authorize(Roles = "Owner,Employee")]
        public IActionResult GetForBusinessDetailed(int businessId)
        {
            var list = _reservationService.GetForBusinessDetailed(businessId);
            return Ok(list);
        }

        // PUT /api/Reservation/{id}/status
        [HttpPut("{id}/status")]
        [Authorize(Roles = "Owner,Employee")]
        public IActionResult UpdateStatus(
            int id,
            [FromBody] UpdateReservationStatusRequest req
        )
        {
            if (!Enum.IsDefined(typeof(DomainReservationStatus), req.Status))
                return BadRequest("Invalid status value.");

            var ok = _reservationService.UpdateReservationStatus(id, req.Status);
            return ok ? NoContent() : NotFound();
        }

        // PUT /api/Reservation/{id}/complete
        [HttpPut("{id}/complete")]
        [Authorize(Roles = "Owner,Employee")]
        public IActionResult Complete(int id)
        {
            var ok = _reservationService.CompleteReservation(id);
            return ok ? NoContent() : NotFound();
        }
    }

    public class CreateReservationRequest
    {
        public int ClothingItemId { get; set; }
    }

    public class UpdateReservationStatusRequest
    {
        public DomainReservationStatus Status { get; set; }
    }
}
