import { parseCurrencies, validateTimeOfDay } from '../src/notifications/fx-notifications.service';

describe('FX notification validation', () => {
  it('parses unique supported currencies', () => {
    expect(parseCurrencies('usd, EUR,usd')).toEqual(['USD', 'EUR']);
  });

  it('rejects unsupported currencies', () => {
    expect(() => parseCurrencies('USD,GBP')).toThrow('currencies підтримує тільки USD та EUR');
  });

  it('validates notification time', () => {
    expect(validateTimeOfDay('09:00')).toBe('09:00');
    expect(() => validateTimeOfDay('24:00')).toThrow('time має бути валідним київським часом HH:mm');
  });
});
