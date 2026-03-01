/**
 * Simple password strength heuristics for UI warnings.
 */

export function isWeakPassword(password: string): boolean {
  const value = password.trim();
  if (value.length < 8) {
    return true;
  }

  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^a-zA-Z0-9]/.test(value);

  const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  return varietyCount < 2;
}
