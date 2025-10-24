import React, { useState } from 'react';
import { subDays, format } from 'date-fns';
import { getUserTimezone } from '../utils/timezone';

export default function DateRangeFilter({ onFilter }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const handleFilter = (days, label, type) => {
    setActiveFilter(label);
    
    if (days === 'all') {
      onFilter({});
    } else if (type === 'today') {
      // Today: start and end date are both today
      const today = new Date();
      onFilter({
        start_date: format(today, 'yyyy-MM-dd'),
        end_date: format(today, 'yyyy-MM-dd'),
      });
    } else if (type === 'yesterday') {
      // Yesterday: start and end date are both yesterday
      const yesterday = subDays(new Date(), 1);
      onFilter({
        start_date: format(yesterday, 'yyyy-MM-dd'),
        end_date: format(yesterday, 'yyyy-MM-dd'),
      });
    } else {
      // Regular date range: from X days ago to today
      const endDate = new Date();
      const startDate = subDays(endDate, days);
      onFilter({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
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
