import { useEffect, useMemo, useRef, useState } from 'react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthParts(month) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(month ?? '')) return null;
  return {
    year: Number(month.slice(0, 4)),
    monthIndex: Number(month.slice(5, 7)) - 1,
  };
}

function formatMonth(month) {
  if (!month) return 'Choose a month';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month));
}

export function HeaderMonthPicker({ availableMonths, selectedMonth, onSelect, loading }) {
  const pickerRef = useRef(null);
  const selectedParts = monthParts(selectedMonth);
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(selectedParts?.year ?? new Date().getUTCFullYear());
  const availableYears = useMemo(
    () => [...new Set(availableMonths.map((month) => monthParts(month)?.year).filter(Boolean))].sort((a, b) => a - b),
    [availableMonths],
  );
  const selectedIndex = availableMonths.indexOf(selectedMonth);
  const olderMonth = selectedIndex >= 0 ? availableMonths[selectedIndex + 1] ?? null : null;
  const newerMonth = selectedIndex > 0 ? availableMonths[selectedIndex - 1] : null;
  const minimumYear = availableYears[0] ?? visibleYear;
  const maximumYear = availableYears.at(-1) ?? visibleYear;

  useEffect(() => {
    if (selectedParts?.year) setVisibleYear(selectedParts.year);
  }, [selectedMonth, selectedParts?.year]);

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutsideClick(event) {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function chooseMonth(month) {
    setOpen(false);
    if (month !== selectedMonth) onSelect(month);
  }

  function monthForIndex(monthIndex) {
    const prefix = `${visibleYear}-${String(monthIndex + 1).padStart(2, '0')}-`;
    return availableMonths.find((month) => month.startsWith(prefix)) ?? null;
  }

  return (
    <div className="header-month" ref={pickerRef}>
      <button
        type="button"
        className="month-arrow"
        aria-label="Previous available month"
        disabled={!olderMonth || loading}
        onClick={() => chooseMonth(olderMonth)}
      >
        ‹
      </button>

      <button
        type="button"
        className="month-picker-trigger"
        aria-label={`Choose month, ${formatMonth(selectedMonth)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={availableMonths.length === 0 || loading}
        onClick={() => setOpen((current) => !current)}
      >
        <strong>{formatMonth(selectedMonth)}</strong>
        <span className="month-caret" aria-hidden="true"></span>
      </button>

      <button
        type="button"
        className="month-arrow"
        aria-label="Next available month"
        disabled={!newerMonth || loading}
        onClick={() => chooseMonth(newerMonth)}
      >
        ›
      </button>

      {open ? (
        <section className="month-popover" role="dialog" aria-label="Choose budget month">
          <div className="month-popover-year">
            <button
              type="button"
              aria-label="Previous year"
              disabled={visibleYear <= minimumYear}
              onClick={() => setVisibleYear((year) => year - 1)}
            >
              ‹
            </button>
            <strong>{visibleYear}</strong>
            <button
              type="button"
              aria-label="Next year"
              disabled={visibleYear >= maximumYear}
              onClick={() => setVisibleYear((year) => year + 1)}
            >
              ›
            </button>
          </div>
          <div className="month-grid">
            {MONTH_NAMES.map((name, monthIndex) => {
              const month = monthForIndex(monthIndex);
              const isSelected = month === selectedMonth;
              return (
                <button
                  key={name}
                  type="button"
                  className={isSelected ? 'month-option month-option-selected' : 'month-option'}
                  aria-label={`${name} ${visibleYear}`}
                  aria-pressed={isSelected}
                  disabled={!month}
                  onClick={() => chooseMonth(month)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
