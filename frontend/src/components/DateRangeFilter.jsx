import React, { useState } from 'react';
import { subDays, format } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { getUserTimezone } from '../utils/timezone';

export default function DateRangeFilter({ onFilter }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const handleFilter = (days, label, type) => {
    setActiveFilter(label);
    const userTimezone = getUserTimezone();
    
    if (days === 'all') {
      onFilter({});
    } else if (type === 'today') {
      // Today: start and end date are both today in user's timezone
      const today = new Date();
      const localToday = utcToZonedTime(today, userTimezone);
      onFilter({
        start_date: format(localToday, 'yyyy-MM-dd'),
        end_date: format(localToday, 'yyyy-MM-dd'),
      });
    } else if (type === 'yesterday') {
      // Yesterday: start and end date are both yesterday in user's timezone
      const yesterday = subDays(new Date(), 1);
      const localYesterday = utcToZonedTime(yesterday, userTimezone);
      onFilter({
        start_date: format(localYesterday, 'yyyy-MM-dd'),
        end_date: format(localYesterday, 'yyyy-MM-dd'),
      });
    } else {
      // Regular date range: from X days ago to today in user's timezone
      const endDate = new Date();
      const startDate = subDays(endDate, days);
      const localStartDate = utcToZonedTime(startDate, userTimezone);
      const localEndDate = utcToZonedTime(endDate, userTimezone);
      onFilter({
        start_date: format(localStartDate, 'yyyy-MM-dd'),
        end_date: format(localEndDate, 'yyyy-MM-dd'),
      });
    }
  };

  const filters = [
    { label: 'today', days: 0, type: 'today' },
    { label: 'yesterday', days: 1, type: 'yesterday' },
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: 'all', days: 'all' },
  ];

  const getButtonText = (label, type) => {
    if (label === 'all') return 'All Time';
    if (type === 'today') return 'Today';
    if (type === 'yesterday') return 'Yesterday';
    return `Last ${label}`;
  };

  return (
    <div className="flex gap-2">
      {filters.map(({ label, days, type }) => (
        <button
          key={label}
          onClick={() => handleFilter(days, label, type)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeFilter === label
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          {getButtonText(label, type)}
        </button>
      ))}
    </div>
  );
}
