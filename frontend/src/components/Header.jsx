import React from 'react';
import { Menu } from 'lucide-react';

export default function Header({ title, subtitle, headerActions, onToggleSidebar }) {
  return (
    <header className="top-header">
      <div className="header-left">
        <button
          type="button"
          className="sidebar-toggle-btn"
          id="sidebarToggle"
          aria-label="Toggle navigation"
          onClick={onToggleSidebar}
        >
          <Menu size={20} />
        </button>
        <div className="header-title">
          <h1>{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="header-actions">
        {headerActions}
      </div>
    </header>
  );
}
