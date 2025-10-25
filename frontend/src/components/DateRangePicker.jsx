import React, { useState, useEffect, useRef } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, isSameDay, isWithinInterval, addDays, subDays as subDaysFn } from 'date-fns';
import { ChevronDown, Calendar, X } from 'lucide-react';

const DateRangePicker = ({ onFilter, initialRange = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState(initialRange);
  const [tempStartDate, setTempStartDate] = useState(null);
  const [tempEndDate, setTempEndDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [recentlyUsed, setRecentlyUsed] = useState([]);
  const dropdownRef = useRef(null);

  // Load recently used ranges from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dateRangePicker_recentlyUsed');
    if (saved) {
      try {
        setRecentlyUsed(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing recently used ranges:', e);
      }
    }
  }, []);

  // Save recently used ranges to localStorage
  const saveRecentlyUsed = (range) => {
    const newRecentlyUsed = [range, ...recentlyUsed.filter(r => 
      !(r.start_date === range.start_date && r.end_date === range.end_date)
    )].slice(0, 3); // Keep only 3 most recent
    
    setRecentlyUsed(newRecentlyUsed);
    localStorage.setItem('dateRangePicker_recentlyUsed', JSON.stringify(newRecentlyUsed));
  };

  // Preset ranges
  const presetRanges = [
    { label: 'Today', getRange: () => {
      const today = new Date();
      return { start_date: format(today, 'yyyy-MM-dd'), end_date: format(today, 'yyyy-MM-dd') };
    }},
    { label: 'Yesterday', getRange: () => {
      const yesterday = subDays(new Date(), 1);
      return { start_date: format(yesterday, 'yyyy-MM-dd'), end_date: format(yesterday, 'yyyy-MM-dd') };
    }},
    { label: 'Last 7 days', getRange: () => {
      const end = new Date();
      const start = subDays(end, 6);
      return { start_date: format(start, 'yyyy-MM-dd'), end_date: format(end, 'yyyy-MM-dd') };
    }},
    { label: 'Last 14 days', getRange: () => {
      const end = new Date();
      const start = subDays(end, 13);
      return { start_date: format(start, 'yyyy-MM-dd'), end_date: format(end, 'yyyy-MM-dd') };
    }},
    { label: 'Last 28 days', getRange: () => {
      const end = new Date();
      const start = subDays(end, 27);
      return { start_date: format(start, 'yyyy-MM-dd'), end_date: format(end, 'yyyy-MM-dd') };
    }},
    { label: 'Last 30 days', getRange: () => {
      const end = new Date();
      const start = subDays(end, 29);
      return { start_date: format(start, 'yyyy-MM-dd'), end_date: format(end, 'yyyy-MM-dd') };
    }},
    { label: 'This week', getRange: () => {
      const now = new Date();
      const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return { start_date: format(start, 'yyyy-MM-dd'), end_date: format(end, 'yyyy-MM-dd') };
    }},
    { label: 'Last week', getRange: () => {
      const now = new Date();
      const lastWeek = subWeeks(now, 1);
      const start = startOfWeek(lastWeek, { weekStartsOn: 1 });
      const end = endOfWeek(lastWeek, { weekStartsOn: 1 });
      return { start_date: format(start, 'yyyy-MM-dd'), end_date: format(end, 'yyyy-MM-dd') };
    }},
    { label: 'This month', getRange: () => {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return { start_date: format(start, 'yyyy-MM-dd'), end_date: format(end, 'yyyy-MM-dd') };
    }},
    { label: 'Last month', getRange: () => {
      const now = new Date();
      const lastMonth = subMonths(now, 1);
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      return { start_date: format(start, 'yyyy-MM-dd'), end_date: format(end, 'yyyy-MM-dd') };
    }},
    { label: 'Maximum', getRange: () => {
      return { start_date: '2020-01-01', end_date: format(new Date(), 'yyyy-MM-dd') };
    }}
  ];

  // Handle preset range selection
  const handlePresetSelect = (preset) => {
    const range = preset.getRange();
    setSelectedRange(range);
    saveRecentlyUsed(range);
    onFilter(range);
    setIsOpen(false);
  };

  // Handle custom date selection
  const handleDateClick = (date) => {
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      // Start new selection
      setTempStartDate(date);
      setTempEndDate(null);
    } else if (tempStartDate && !tempEndDate) {
      // Complete selection
      const start = tempStartDate < date ? tempStartDate : date;
      const end = tempStartDate < date ? date : tempStartDate;
      setTempStartDate(start);
      setTempEndDate(end);
    }
  };

  // Apply custom range
  const applyCustomRange = () => {
    if (tempStartDate && tempEndDate) {
      const range = {
        start_date: format(tempStartDate, 'yyyy-MM-dd'),
        end_date: format(tempEndDate, 'yyyy-MM-dd')
      };
      setSelectedRange(range);
      saveRecentlyUsed(range);
      onFilter(range);
      setIsOpen(false);
    }
  };

  // Cancel custom range selection
  const cancelCustomRange = () => {
    setTempStartDate(null);
    setTempEndDate(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        cancelCustomRange();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate calendar days
  const generateCalendarDays = (month) => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const startDate = startOfWeek(start, { weekStartsOn: 1 });
    const endDate = endOfWeek(end, { weekStartsOn: 1 });
    
    const days = [];
    let current = startDate;
    
    while (current <= endDate) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    
    return days;
  };

  // Check if date is in range
  const isDateInRange = (date, start, end) => {
    if (!start || !end) return false;
    return isWithinInterval(date, { start, end });
  };

  // Check if date is selected
  const isDateSelected = (date, start, end) => {
    if (!start || !end) return false;
    return isSameDay(date, start) || isSameDay(date, end);
  };

  // Get display text for current range
  const getDisplayText = () => {
    if (!selectedRange) return 'Select date range';
    
    const startDate = new Date(selectedRange.start_date);
    const endDate = new Date(selectedRange.end_date);
    
    if (isSameDay(startDate, endDate)) {
      return format(startDate, 'MMM d, yyyy');
    } else {
      return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    }
  };

  // Navigate months
  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + direction);
      return newMonth;
    });
  };

  const days = generateCalendarDays(currentMonth);
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextDays = generateCalendarDays(nextMonth);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{getDisplayText()}</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[800px]">
          <div className="flex">
            {/* Left Sidebar - Preset Ranges */}
            <div className="w-48 border-r border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Select</h3>
              
              {/* Recently Used */}
              {recentlyUsed.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recently Used</h4>
                  {recentlyUsed.map((range, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedRange(range);
                        onFilter(range);
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded"
                    >
                      {format(new Date(range.start_date), 'MMM d')} - {format(new Date(range.end_date), 'MMM d, yyyy')}
                    </button>
                  ))}
                </div>
              )}

              {/* Preset Ranges */}
              <div className="space-y-1">
                {presetRanges.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => handlePresetSelect(preset)}
                    className="w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Side - Calendar */}
            <div className="flex-1 p-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                <h3 className="text-sm font-medium text-gray-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-xs font-medium text-gray-500 text-center py-1 px-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {days.map((day, index) => {
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const isSelected = isDateSelected(day, tempStartDate, tempEndDate);
                  const isInRange = isDateInRange(day, tempStartDate, tempEndDate);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <button
                      key={index}
                      onClick={() => handleDateClick(day)}
                      className={`
                        w-10 h-10 text-sm rounded flex items-center justify-center
                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                        ${isToday ? 'bg-primary-100 text-primary-700 font-medium' : ''}
                        ${isSelected ? 'bg-primary text-white font-medium' : ''}
                        ${isInRange && !isSelected ? 'bg-primary-50 text-primary-700' : ''}
                        hover:bg-primary-100 hover:text-primary-700
                      `}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              {/* Second Month */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => navigateMonth(-1)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                  </button>
                  <h3 className="text-sm font-medium text-gray-900">
                    {format(nextMonth, 'MMMM yyyy')}
                  </h3>
                  <button
                    onClick={() => navigateMonth(1)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronDown className="w-4 h-4 -rotate-90" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="text-xs font-medium text-gray-500 text-center py-1 px-1">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {nextDays.map((day, index) => {
                    const isCurrentMonth = day.getMonth() === nextMonth.getMonth();
                    const isSelected = isDateSelected(day, tempStartDate, tempEndDate);
                    const isInRange = isDateInRange(day, tempStartDate, tempEndDate);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <button
                        key={index}
                        onClick={() => handleDateClick(day)}
                        className={`
                          w-10 h-10 text-sm rounded flex items-center justify-center
                          ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                          ${isToday ? 'bg-primary-100 text-primary-700 font-medium' : ''}
                          ${isSelected ? 'bg-primary text-white font-medium' : ''}
                          ${isInRange && !isSelected ? 'bg-primary-50 text-primary-700' : ''}
                          hover:bg-primary-100 hover:text-primary-700
                        `}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Range Display */}
              {tempStartDate && tempEndDate && (
                <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="text-sm text-primary-800">
                    <strong>Selected:</strong> {format(tempStartDate, 'MMM d, yyyy')} - {format(tempEndDate, 'MMM d, yyyy')}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    cancelCustomRange();
                  }}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={applyCustomRange}
                  disabled={!tempStartDate || !tempEndDate}
                  className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
