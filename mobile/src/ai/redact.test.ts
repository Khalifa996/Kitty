/// <reference types="jest" />
import { redact } from './redact';

it('removes account numbers, card endings, sort codes and emails, but keeps amounts', () => {
  expect(redact("Pers acct - You've spent £12.30 with TESCO from your account ending 1234.")).toBe("Pers acct - You've spent £12.30 with TESCO from your account ending ••••.");
  expect(redact('£8.30 with Revolut Visa ••1234')).toBe('£8.30 with Revolut Visa ••••');
  expect(redact('Paid to 12-34-56 12345678')).toBe('Paid to [sort code] ••••');
  expect(redact('Receipt sent to sam@example.com')).toBe('Receipt sent to [email]');
  expect(redact("You've used 50% of your £2,500 monthly budget")).toBe("You've used 50% of your £2,500 monthly budget");
});
