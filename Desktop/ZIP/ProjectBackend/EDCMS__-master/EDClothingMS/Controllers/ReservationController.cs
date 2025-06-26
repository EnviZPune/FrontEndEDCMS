using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Application.Services;

namespace EDClothingMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "SimpleUser")]
    public class ReservationController : ControllerBase
    {
        private readonly ReservationService _reservationService;

        public ReservationController(ReservationService reservationService)
        {
            _reservationService = reservationService;
        }

        [HttpPost]
        public IActionResult Create([FromBody] CreateReservationRequest req)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

            var dto = new ReservationDTO
            {
                ClothingItemId = req.ClothingItemId,
                SimpleUserId   = userId,
                Status         = ReservationStatus.Pending
            };

            var reservation = _reservationService.CreateReservation(dto);
            return CreatedAtAction(nameof(GetById),
                new { id = reservation.ReservationId },
                reservation);
        }

        [HttpGet("{id}")]
        public IActionResult GetById(int id)
        {
            var res = _reservationService.GetById(id);
            if (res == null) return NotFound();
            return Ok(res);
        }
    }

    public class CreateReservationRequest
    {
        public int ClothingItemId { get; set; }
    }
}