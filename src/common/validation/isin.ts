const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export function normalizeIsin(value: string): string {
  const isin = value.trim().toUpperCase();
  if (!ISIN_REGEX.test(isin) || !hasValidIsinCheckDigit(isin)) {
    throw new Error('ISIN має містити 12 символів і валідну check digit');
  }
  return isin;
}

function hasValidIsinCheckDigit(isin: string): boolean {
  let expanded = '';
  for (const char of isin) {
    if (char >= 'A' && char <= 'Z') {
      expanded += String(char.charCodeAt(0) - 55);
    } else {
      expanded += char;
    }
  }

  let sum = 0;
  let doubleDigit = false;
  for (let index = expanded.length - 1; index >= 0; index -= 1) {
    let digit = Number(expanded[index]);
    if (doubleDigit) {
      digit *= 2;
      sum += Math.floor(digit / 10) + (digit % 10);
    } else {
      sum += digit;
    }
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}
