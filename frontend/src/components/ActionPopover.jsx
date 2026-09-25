import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export default function ActionPopover({ items = [], dropup: forcedDropup }) {
  const [open, setOpen] = useState(false);
  const [isDropup, setIsDropup] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Determine whether the popover should open upwards (on top) or downwards
  const determinePlacement = () => {
    if (forcedDropup !== undefined) return Boolean(forcedDropup);
    if (!dropdownRef.current) return false;

    const rect = dropdownRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Check enclosing container (card, table-container, or table)
    const table = dropdownRef.current.closest('table');
    const container = dropdownRef.current.closest('.card, .table-container') || table;

    const tableBottom = table ? table.getBoundingClientRect().bottom : window.innerHeight;
    const tableSpaceBelow = tableBottom - rect.bottom;

    const containerBottom = container ? container.getBoundingClientRect().bottom : window.innerHeight;
    const containerSpaceBelow = containerBottom - rect.bottom;

    // Check row index in table
    const tr = dropdownRef.current.closest('tr');
    const tbody = tr?.closest('tbody') || tr?.parentElement;
    let isBottomRow = false;
    let isTopRow = false;

    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
      const totalRows = rows.length;
      const index = rows.indexOf(tr);

      if (index === 0) {
        isTopRow = true;
      }

      if (totalRows >= 2) {
        // Treat bottom rows as bottom data:
        // In 2 or 3 row tables: rows with index >= 1 (e.g. 2nd & 3rd rows)
        // In 4 to 7 row tables: the bottom 2 to 3 rows
        // In 8+ row tables: the bottom 3 to 4 rows (bottom ~35%)
        const bottomThreshold =
          totalRows <= 3
            ? 1
            : totalRows <= 7
            ? totalRows - 2
            : Math.max(totalRows - 3, Math.floor(totalRows * 0.65));
        if (index >= bottomThreshold) {
          isBottomRow = true;
        }
      }
    }

    // Dynamic item height estimation (~38px per item + 16px padding + dividers)
    const estimatedHeight = Math.max((items?.length || 2) * 38 + 20, 105);

    // Can we dropup safely without clipping off the top of the browser viewport?
    // Need at least min(estimatedHeight, 100px) above the trigger button
    const canDropupSafely = spaceAbove >= Math.min(estimatedHeight, 100);

    if (!canDropupSafely) {
      return false;
    }

    // 1. If it's explicitly identified as bottom data in the table, always pop up on top!
    if (isBottomRow) {
      return true;
    }

    // 2. If opening downwards will overflow the table bottom
    if (tableSpaceBelow < estimatedHeight + 25 && !isTopRow) {
      return true;
    }

    // 3. If opening downwards will overflow the card bottom
    if (containerSpaceBelow < estimatedHeight + 20 && !isTopRow) {
      return true;
    }

    // 4. If space below in viewport is tight (requires scrolling)
    if (spaceBelow < estimatedHeight + 35) {
      return true;
    }

    // 5. If space below is generally constrained (< 220px) and there is more room above
    if (spaceBelow < 220 && spaceAbove > spaceBelow && !isTopRow) {
      return true;
    }

    return false;
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open) {
      setIsDropup(determinePlacement());
    }
    setOpen((prev) => !prev);
  };

  // Secondary check once the menu is actually mounted in DOM
  useEffect(() => {
    if (open && menuRef.current && dropdownRef.current && forcedDropup === undefined) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const menuHeight = menuRef.current.offsetHeight || 110;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const container = dropdownRef.current.closest('.card, .table-container, table');
      const containerBottom = container ? container.getBoundingClientRect().bottom : window.innerHeight;
      const containerSpaceBelow = containerBottom - rect.bottom;

      if (!isDropup) {
        if ((spaceBelow < menuHeight + 15 || containerSpaceBelow < menuHeight + 10) && spaceAbove >= menuHeight) {
          setIsDropup(true);
        }
      }
    }
  }, [open, isDropup, forcedDropup]);

  return (
    <div className="action-popover-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`action-popover-trigger ${open ? 'active' : ''}`}
        onClick={handleToggle}
        title="Actions"
        aria-label="Actions"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div ref={menuRef} className={`action-popover-menu open ${isDropup ? 'dropup' : ''}`.trim()}>
          {items.map((item, idx) => {
            if (item.isDivider) {
              return <div key={`div-${idx}`} className="action-popover-divider" />;
            }
            const Icon = item.icon;
            let className = 'action-popover-item';
            if (item.isDanger) className += ' text-danger';
            else if (item.isPrimary) className += ' text-primary';
            else if (item.isSuccess) className += ' text-success';

            return (
              <button
                key={idx}
                type="button"
                className={className}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (item.onClick) item.onClick();
                }}
              >
                {Icon && <Icon size={14} />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
