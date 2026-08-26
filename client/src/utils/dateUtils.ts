// Standard date format: DD.MMM.YYYY (e.g., 15.Jan.2024)
export const formatDateDisplay = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
};

// Format Date object to display format
export const formatDateObjectDisplay = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

// Format for API (YYYY-MM-DD)
export const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Parse display format back to Date
export const parseDateDisplay = (dateStr: string): Date | null => {
  try {
    // Handle DD.MMM.YYYY format
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames.indexOf(parts[1]);
      const year = parseInt(parts[2]);

      if (!isNaN(day) && month !== -1 && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    return null;
  } catch {
    return null;
  }
};

