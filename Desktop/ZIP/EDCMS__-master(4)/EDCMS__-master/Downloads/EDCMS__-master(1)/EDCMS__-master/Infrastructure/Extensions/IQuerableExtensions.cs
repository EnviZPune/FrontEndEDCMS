using System;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Infrastructure.utils.PaginationWrapper;
using Infrastructure.utils.GroupByWrapper;

namespace Infrastructure.Extensions
{
    public static class IQueryableExtensions
    {
        public static async Task<PaginatedResult<T>> ToPaginatedListAsync<T>(this IQueryable<T> query, int pageNumber, int pageSize)
        {
            var totalCount = await query.CountAsync();
            var items = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            
            return new PaginatedResult<T>(items, totalCount, pageNumber, pageSize);
        }

        public static async Task<GroupByResult<T>> GroupByItemAsync<T>(
            this IQueryable<T> query,
            string key,
            bool paginated = false,
            int pageNumber = 1,
            int pageSize = 10)
        {
            if (string.IsNullOrWhiteSpace(key))
                throw new ArgumentException("Key must be provided", nameof(key));

            var grouped = query.GroupBy(x => EF.Property<object>(x, key));

            var totalGroups = await grouped.CountAsync();

            if (paginated)
            {
                grouped = grouped
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize);
            }

            var groups = await grouped
                .Select(g => new Group<T>(g.Key, g.ToList()))
                .ToListAsync();

            return new GroupByResult<T>(groups, totalGroups, pageNumber, pageSize);
        }
    }
}
