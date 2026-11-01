// Takes out anything that identifies an account before an alert leaves the phone.
export function redact(s: string): string {
  return (s || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\b\d{2}-\d{2}-\d{2}\b/g, '[sort code]')
    .replace(/((?:ending(?: in)?|account|acct|card|number|no\.?)\s*(?:[•*x·.]\s*)*)\d{3,}/gi, '$1••••')
    .replace(/[•*]{2,}\s?\d{3,}/g, '••••')
    .replace(/\b\d{6,}\b/g, '••••');
}
