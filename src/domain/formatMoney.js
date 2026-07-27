export function milliunitsToDecimal(milliunits) {
  return milliunits / 1000;
}

export function formatMilliunits(milliunits, currencyFormat) {
  const decimalDigits = currencyFormat?.decimal_digits ?? 2;
  const value = milliunitsToDecimal(milliunits);

  if (currencyFormat?.iso_code) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyFormat.iso_code,
      minimumFractionDigits: decimalDigits,
      maximumFractionDigits: decimalDigits,
    }).format(value);
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimalDigits,
    maximumFractionDigits: decimalDigits,
  }).format(value);
}
