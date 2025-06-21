using System;
using System.Collections.Generic;


namespace Infrastructure.utils.GroupByWrapper
{
    public class Group<T>
    {
        public object Key { get; }
        public List<T> Items { get; }

        public Group(object key, List<T> items)
        {
            Key = key ?? throw new ArgumentNullException(nameof(key));
            Items = items ?? throw new ArgumentNullException(nameof(items));
        }
    }
    public class GroupByResult<T>
    {
        public List<Group<T>> GroupByItems { get; }
        public int TotalGroups { get; }
        public int PageNumber { get; }
        public int PageSize { get; }

        public GroupByResult(
            List<Group<T>> groupByItems,
            int totalGroups,
            int pageNumber,
            int pageSize)
        {
            GroupByItems = groupByItems ?? throw new ArgumentNullException(nameof(groupByItems));
            TotalGroups   = totalGroups;
            PageNumber    = pageNumber;
            PageSize      = pageSize;
        }
    }
}