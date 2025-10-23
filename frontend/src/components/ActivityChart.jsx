import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

const ActivityChart = React.memo(function ActivityChart({ data, height = 300 }) {
  // Format dates for display (memoized to prevent unnecessary recalculations)
  const formattedData = useMemo(() => 
    data.map(item => ({
      ...item,
      displayDate: format(parseISO(item.date), 'MMM d'),
    })), [data]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Over Time</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayDate" />
          <YAxis />
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
