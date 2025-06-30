using Application.DTOs;
using Infrastructure;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Application.Services
{
    public class ApprovalService
    {
        private readonly ClothingStoreDbContext _context;

        public ApprovalService(ClothingStoreDbContext context)
        {
            _context = context;
        }

        public IEnumerable<ApprovalDTO> GetAll(ClaimsPrincipal user)
        {
            var ownerId = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "UserId").Value);

            return _context.Approvals
                .Include(a => a.ProposedChange.ClothingItem.Businesses) 
                .Where(a => a.OwnerId == ownerId && a.Approved == true)
                .Select(a => new ApprovalDTO
                {
                    ApprovalId = a.ApprovalId,
                    ProposedChangeId = a.ProposedChangeId,
                    OwnerId = a.OwnerId,
                    Approved = a.Approved,
                    CreatedAt = a.CreatedAt
                }).ToList();
        }

        public ApprovalDTO GetById(int id, ClaimsPrincipal user)
        {
            var ownerId = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "UserId").Value);

            var approval = _context.Approvals
                .Include(a => a.ProposedChange.ClothingItem.Businesses) 
                .SingleOrDefault(a => a.ApprovalId == id && a.OwnerId == ownerId && a.Approved == true);

            if (approval == null) return null;

            return new ApprovalDTO
            {
                ApprovalId = approval.ApprovalId,
                ProposedChangeId = approval.ProposedChangeId,
                OwnerId = approval.OwnerId,
                Approved = approval.Approved,
                CreatedAt = approval.CreatedAt
            };
        }

        public bool DeleteApproval(int id, ClaimsPrincipal user)
        {
            var ownerId = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "UserId").Value);

            var approval = _context.Approvals.SingleOrDefault(a => a.ApprovalId == id && a.OwnerId == ownerId);
            if (approval == null) return false;

            _context.Approvals.Remove(approval);
            _context.SaveChanges();
            return true;
        }
    }
}
