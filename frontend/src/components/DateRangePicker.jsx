import React, { useState, useEffect, useRef } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, isSameDay, isWithinInterval, addDays, subDays as subDaysFn } from 'date-fns';
import { ChevronDown, Calendar, X } from 'lucide-react';
import { formatDateForBackend } from '../utils/timezone';

const DateRangePicker = ({ onFilter, initialRange = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState(initialRange);

  // Update selectedRange when initialRange prop changes
  useEffect(() => {
    setSelectedRange(initialRange);
  }, [initialRange]);
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
      return { start_date: formatDateForBackend(today), end_date: formatDateForBackend(today) };
    }},
    { label: 'Yesterday', getRange: () => {
      const yesterday = subDays(new Date(), 1);
      return { start_date: formatDateForBackend(yesterday), end_date: formatDateForBackend(yesterday) };
    }},
    { label: 'Last 7 days', getRange: () => {
      const end = new Date();
      const start = subDays(end, 6);
      return { start_date: formatDateForBackend(start), end_date: formatDateForBackend(end) };
    }},
    { label: 'Last 14 days', getRange: () => {
      const end = new Date();
      const start = subDays(end, 13);
      return { start_date: formatDateForBackend(start), end_date: formatDateForBackend(end) };
    }},
    { label: 'Last 28 days', getRange: () => {
      const end = new Date();
      const start = subDays(end, 27);
      return { start_date: formatDateForBackend(start), end_date: formatDateForBackend(end) };
    }},
    { label: 'Last 30 days', getRange: () => {
      const end = new Date();
      const start = subDays(end, 29);
      return { start_date: formatDateForBackend(start), end_date: formatDateForBackend(end) };
    }},
    { label: 'This week', getRange: () => {
      const now = new Date();
      const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return { start_date: formatDateForBackend(start), end_date: formatDateForBackend(end) };
    }},
    { label: 'Last week', getRange: () => {
      const now = new Date();
      const lastWeek = subWeeks(now, 1);
      const start = startOfWeek(lastWeek, { weekStartsOn: 1 });
      const end = endOfWeek(lastWeek, { weekStartsOn: 1 });
      return { start_date: formatDateForBackend(start), end_date: formatDateForBackend(end) };
    }},
    { label: 'This month', getRange: () => {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return { start_date: formatDateForBackend(start), end_date: formatDateForBackend(end) };
    }},
    { label: 'Last month', getRange: () => {
      const now = new Date();
      const lastMonth = subMonths(now, 1);
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      return { start_date: formatDateForBackend(start), end_date: formatDateForBackend(end) };
    }},
    { label: 'Maximum', getRange: () => {
      return { start_date: '2025-01-01', end_date: formatDateForBackend(new Date()) };
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
        start_date: formatDateForBackend(tempStartDate),
        end_date: formatDateForBackend(tempEndDate)
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
    if (!selectedRange || !selectedRange.start_date || !selectedRange.end_date) {
      return 'Select date range';
    }
    
    const startDate = new Date(selectedRange.start_date + 'T00:00:00');
    const endDate = new Date(selectedRange.end_date + 'T00:00:00');
    
    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return 'Select date range';
    }
    
    
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
        className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{getDisplayText()}</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-[480px]">
          <div className="flex">
            {/* Left Sidebar - Preset Ranges */}
            <div className="w-48 border-r border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Select</h3>
              
              {/* Recently Used */}
              {recentlyUsed.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recently Used</h4>
                  {recentlyUsed.map((range, index) => {
                    const startDate = new Date(range.start_date + 'T00:00:00');
                    const endDate = new Date(range.end_date + 'T00:00:00');
                    const isValidRange = !isNaN(startDate.getTime()) && !isNaN(endDate.getTime());
                    
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (isValidRange) {
                            setSelectedRange(range);
                            onFilter(range);
                            setIsOpen(false);
                          }
                        }}
                        className={`w-full text-left px-2 py-1 text-sm rounded ${
                          isValidRange 
                            ? 'text-gray-700 hover:bg-primary-50 hover:text-primary-700' 
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                        disabled={!isValidRange}
                      >
                        {isValidRange 
                          ? `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
                          : 'Invalid date range'
                        }
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Preset Ranges */}
              <div className="space-y-1">
                {presetRanges.map((preset, index) => {
                  const presetRange = preset.getRange();
                  const isActive = selectedRange && 
                    selectedRange.start_date === presetRange.start_date && 
                    selectedRange.end_date === presetRange.end_date;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handlePresetSelect(preset)}
                      className={`w-full text-left px-2 py-1 text-sm rounded ${
                        isActive 
                          ? 'bg-primary-100 text-primary-700 font-medium' 
                          : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
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
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-xs font-medium text-gray-500 text-center py-1 px-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
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
                        w-8 h-8 text-xs rounded flex items-center justify-center
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
              <div className="mt-4">
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

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="text-xs font-medium text-gray-500 text-center py-1 px-1">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
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
                          w-8 h-8 text-xs rounded flex items-center justify-center
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
              {(tempStartDate && tempEndDate) || (selectedRange && selectedRange.start_date && selectedRange.end_date) ? (
                <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="text-sm text-primary-800">
                    <strong>Selected:</strong> {
                      tempStartDate && tempEndDate 
                        ? `${format(tempStartDate, 'MMM d, yyyy')} - ${format(tempEndDate, 'MMM d, yyyy')}`
                        : selectedRange && selectedRange.start_date && selectedRange.end_date
                          ? (() => {
                              const startDate = new Date(selectedRange.start_date + 'T00:00:00');
                              const endDate = new Date(selectedRange.end_date + 'T00:00:00');
                              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                                return 'Invalid date range';
                              }
                              return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
                            })()
                          : 'No range selected'
                    }
                  </div>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="flex justify-end gap-1 mt-4">
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
