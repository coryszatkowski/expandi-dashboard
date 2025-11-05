import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { formatChartDate } from '../utils/timezone';

const ActivityChart = React.memo(function ActivityChart({ data, height = 300 }) {
  // Format dates for display (memoized to prevent unnecessary recalculations)
  const formattedData = useMemo(() => 
    data.map(item => ({
      ...item,
      displayDate: formatChartDate(item.date),
    })), [data]);

  // Calculate y-axis domain: minimum 40, scale in increments of 5
  const { yAxisMax, yAxisTicks } = useMemo(() => {
    // Minimum top value is 40
    const minTop = 40;
    
    // Find the maximum value across all data points and all fields
    let maxValue = 0;
    if (formattedData.length > 0) {
      const allValues = formattedData.flatMap(item => [
        item.invites || 0,
        item.connections || 0,
        item.replies || 0
      ]);
      maxValue = Math.max(...allValues);
    }
    
    // If max is less than or equal to 40, use 40
    // Otherwise, round up to the next multiple of 5
    let calculatedMax;
    if (maxValue <= minTop) {
      calculatedMax = minTop;
    } else {
      // Round up to next multiple of 5
      calculatedMax = Math.ceil(maxValue / 5) * 5;
    }

    // Generate ticks in increments of 5 from 0 to calculatedMax
    const ticks = [];
    for (let i = 0; i <= calculatedMax; i += 5) {
      ticks.push(i);
    }

    return {
      yAxisMax: calculatedMax,
      yAxisTicks: ticks
    };
  }, [formattedData]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Over Time</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayDate" />
          <YAxis 
            type="number"
            scale="linear"
            domain={[0, yAxisMax]}
            allowDecimals={false}
            width={60}
            tick={false}
            axisLine={true}
          />
          {/* Manually render all tick labels using ReferenceLine to bypass Recharts filtering */}
          {yAxisTicks.map((tickValue) => (
            <ReferenceLine 
              key={tickValue} 
              y={tickValue} 
              stroke="none"
              label={
                <Label 
                  value={tickValue} 
                  position="left" 
                  style={{ 
                    textAnchor: 'end', 
                    fill: '#666', 
                    fontSize: '14px',
                    fontWeight: 400
                  }}
                  offset={5}
                />
              }
            />
          ))}
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="invites" stroke="#3b82f6" name="Invites" />
          <Line type="monotone" dataKey="connections" stroke="#10b981" name="Connections" />
          <Line type="monotone" dataKey="replies" stroke="#f59e0b" name="Replies" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default ActivityChart;
