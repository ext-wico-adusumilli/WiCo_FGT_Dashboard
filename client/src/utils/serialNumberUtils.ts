/**
 * Normalizes serial numbers to ensure consistency across the application
 * Removes leading zeros to treat "035" same as "35", "051" same as "51", etc.
 * Examples: "035" -> "35", "051" -> "51", "054" -> "54", "058" -> "58"
 */
export function normalizeSerialNumber(sn: string | null | undefined): string {
  if (!sn || typeof sn !== 'string') {
    return '';
  }

  const trimmed = sn.trim();
  
  // If it's empty after trimming, return empty
  if (!trimmed) {
    return '';
  }

  // Remove leading zeros but keep at least one digit
  const normalized = trimmed.replace(/^0+/, '') || '0';
  
  return normalized;
}

/**
 * Normalizes an array of serial numbers
 */
export function normalizeSerialNumbers(sns: (string | null | undefined)[]): string[] {
  return sns
    .map(normalizeSerialNumber)
    .filter(sn => sn !== '')
    .filter((sn, index, array) => array.indexOf(sn) === index) // Remove duplicates
    .sort();
}
