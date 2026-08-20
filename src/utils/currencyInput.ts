/**
 * Shared helpers for editable Rupiah fields.
 * Keep state as raw digits, display as formatted Rupiah.
 */
export const sanitizeRupiahInput = (
  value: string
): string =>
  value
    .replace(/[^0-9]/g, '')
    .replace(/^0+(?=\d)/, '');

export const formatRupiahInput = (
  value: string | number | null | undefined
): string => {
  const digits =
    sanitizeRupiahInput(
      String(value ?? '')
    );

  if (!digits) {
    return '';
  }

  return `Rp${digits.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.'
  )}`;
};
