import React from 'react';

const Header = ({ children, className = "" }) => {
  return (
    <div className={`bg-white shadow-sm border-b border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - empty for now, can be used for navigation */}
          <div className="flex-1"></div>
          
          {/* Center - Logo */}
          <div className="flex justify-center">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-10 h-10"
            />
          </div>
          
          {/* Right side - page-specific content */}
          <div className="flex-1 flex justify-end">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
