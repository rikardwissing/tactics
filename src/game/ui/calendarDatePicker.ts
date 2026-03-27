const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
] as const;

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function toYmd(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const result = new Date(year, month, day);

  if (result.getFullYear() !== year || result.getMonth() !== month || result.getDate() !== day) {
    return null;
  }

  return result;
}

export interface CalendarDatePickerOptions {
  initialDateYmd?: string;
  title?: string;
  confirmLabel?: string;
}

export function pickCalendarDate(options: CalendarDatePickerOptions = {}): Promise<string | null> {
  const initial = options.initialDateYmd ? parseYmd(options.initialDateYmd) : null;
  const now = new Date();
  const initialDate = initial ?? now;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'renations-calendar-picker-overlay';

    const dialog = document.createElement('section');
    dialog.className = 'renations-calendar-picker';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const title = document.createElement('h2');
    title.className = 'renations-calendar-picker__title';
    title.textContent = options.title ?? 'Choose Date';

    const monthBar = document.createElement('div');
    monthBar.className = 'renations-calendar-picker__month-bar';

    const previousButton = document.createElement('button');
    previousButton.type = 'button';
    previousButton.className = 'renations-calendar-picker__nav-button';
    previousButton.textContent = '◀';

    const monthLabel = document.createElement('div');
    monthLabel.className = 'renations-calendar-picker__month-label';

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'renations-calendar-picker__nav-button';
    nextButton.textContent = '▶';

    const weekdays = document.createElement('div');
    weekdays.className = 'renations-calendar-picker__weekdays';

    for (const label of WEEKDAY_LABELS) {
      const cell = document.createElement('div');
      cell.className = 'renations-calendar-picker__weekday';
      cell.textContent = label;
      weekdays.append(cell);
    }

    const dayGrid = document.createElement('div');
    dayGrid.className = 'renations-calendar-picker__days';

    const actionBar = document.createElement('div');
    actionBar.className = 'renations-calendar-picker__actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'renations-calendar-picker__action renations-calendar-picker__action--secondary';
    cancelButton.textContent = 'Cancel';

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'renations-calendar-picker__action renations-calendar-picker__action--primary';
    confirmButton.textContent = options.confirmLabel ?? 'Use Date';

    monthBar.append(previousButton, monthLabel, nextButton);
    actionBar.append(cancelButton, confirmButton);
    dialog.append(title, monthBar, weekdays, dayGrid, actionBar);
    overlay.append(dialog);
    document.body.append(overlay);

    let activeMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
    let selectedYmd = toYmd(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate());

    const close = (value: string | null): void => {
      window.removeEventListener('keydown', handleKeyDown);
      overlay.remove();
      resolve(value);
    };

    const render = (): void => {
      monthLabel.textContent = `${MONTH_NAMES[activeMonth.getMonth()]} ${activeMonth.getFullYear()}`;
      dayGrid.replaceChildren();

      const firstWeekday = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1).getDay();
      const daysInMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0).getDate();

      for (let i = 0; i < firstWeekday; i += 1) {
        const spacer = document.createElement('div');
        spacer.className = 'renations-calendar-picker__day renations-calendar-picker__day--spacer';
        dayGrid.append(spacer);
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const dayButton = document.createElement('button');
        dayButton.type = 'button';
        dayButton.className = 'renations-calendar-picker__day';
        const ymd = toYmd(activeMonth.getFullYear(), activeMonth.getMonth(), day);
        dayButton.dataset.date = ymd;
        dayButton.textContent = String(day);

        if (ymd === selectedYmd) {
          dayButton.classList.add('renations-calendar-picker__day--selected');
        }

        dayButton.addEventListener('click', () => {
          selectedYmd = ymd;
          render();
        });

        dayGrid.append(dayButton);
      }

      confirmButton.disabled = !selectedYmd;
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(null);
      }
    };

    previousButton.addEventListener('click', () => {
      activeMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1);
      render();
    });

    nextButton.addEventListener('click', () => {
      activeMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1);
      render();
    });

    cancelButton.addEventListener('click', () => close(null));
    confirmButton.addEventListener('click', () => close(selectedYmd));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    window.addEventListener('keydown', handleKeyDown);
    render();
  });
}
