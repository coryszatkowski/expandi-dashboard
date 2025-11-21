import React from 'react';
import { X } from 'lucide-react';

const Tag = ({ text, onDelete, canDelete }) => {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
      {text}
      {canDelete && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="hover:bg-green-200 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
          title="Remove tag"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

export default Tag;

