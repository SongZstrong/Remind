/**
 * Password Manager - account credential management
 * Supports multiple accounts with isolated credentials and data
 */

import { encryptNote, decryptNote, sha256Hex } from './seal-engine';

const ACCOUNTS_KEY = 'void-accounts';
const CURRENT_USER_KEY = 'void-current-user';
const VAULT_LOCK_KEY = 'remind-vault-locked';
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,24}$/;

export const USERNAME_RULE_HINT = 'Username must be 3-24 characters and can include letters, numbers, underscore (_), and hyphen (-). Numeric-only usernames are allowed.';

interface AccountInfo {
  username: string;
  passwordHash: string;
  encryptedTest: string; // Encrypted sentinel used for password verification
  createdAt: number;
}

function normalizeUsername(username: string): string {
  return username.toLowerCase().trim();
}

export function validateUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}

/**
 * Get all accounts
 */
function getAllAccounts(): Record<string, AccountInfo> {
  const data = localStorage.getItem(ACCOUNTS_KEY);
  if (!data) {
    return {};
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to parse account data:', error);
    localStorage.removeItem(ACCOUNTS_KEY);
    return {};
  }
}

/**
 * Save all accounts
 */
function saveAccounts(accounts: Record<string, AccountInfo>): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

/**
 * Check whether an account exists
 */
export function accountExists(username: string): boolean {
  const normalizedUsername = normalizeUsername(username);
  if (!validateUsername(normalizedUsername)) {
    return false;
  }
  const accounts = getAllAccounts();
  return normalizedUsername in accounts;
}

/**
 * Create a new account
 * @param username - Account name
 * @param password - Account password
 */
export async function createAccount(username: string, password: string): Promise<void> {
  const normalizedUsername = normalizeUsername(username);

  if (!password) {
    throw new Error('Username and password are required');
  }
  if (!validateUsername(normalizedUsername)) {
    throw new Error('USERNAME_INVALID');
  }

  if (accountExists(normalizedUsername)) {
    throw new Error('Account already exists');
  }

  // Encrypt a sentinel string with the password
  const testString = 'VOID_PASSWORD_VERIFICATION';
  const encryptedTest = await encryptNote(testString, password);

  // Generate password hash
  const passwordHash = await sha256Hex(password);

  // Persist account record
  const accounts = getAllAccounts();
  accounts[normalizedUsername] = {
    username: normalizedUsername,
    passwordHash,
    encryptedTest,
    createdAt: Date.now(),
  };

  saveAccounts(accounts);
  setCurrentUser(normalizedUsername);
}

/**
 * Verify username and password
 * @param username - Account name
 * @param password - Account password
 * @returns Whether verification succeeds
 */
export async function verifyAccount(username: string, password: string): Promise<boolean> {
  const normalizedUsername = normalizeUsername(username);
  if (!validateUsername(normalizedUsername)) {
    throw new Error('USERNAME_INVALID');
  }
  const accounts = getAllAccounts();
  const account = accounts[normalizedUsername];

  if (!account) {
    return false;
  }

  try {
    // Try decrypting the sentinel string
    const decrypted = await decryptNote(account.encryptedTest, password);
    if (decrypted === 'VOID_PASSWORD_VERIFICATION') {
      setCurrentUser(normalizedUsername);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Set current user
 */
export function setCurrentUser(username: string): void {
  localStorage.setItem(CURRENT_USER_KEY, normalizeUsername(username));
}

/**
 * Get current user
 */
export function getCurrentUser(): string | null {
  const currentUser = localStorage.getItem(CURRENT_USER_KEY);
  if (!currentUser) {
    return null;
  }

  const accounts = getAllAccounts();
  if (currentUser in accounts) {
    return currentUser;
  }

  localStorage.removeItem(CURRENT_USER_KEY);
  return null;
}

/**
 * Log out current user
 */
export function logout(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
}

/**
 * Vault lock flag for auto-lock / background lock.
 */
export function setVaultLocked(locked: boolean): void {
  localStorage.setItem(VAULT_LOCK_KEY, locked ? 'true' : 'false');
}

export function isVaultLocked(): boolean {
  return localStorage.getItem(VAULT_LOCK_KEY) === 'true';
}

export function clearVaultLock(): void {
  localStorage.removeItem(VAULT_LOCK_KEY);
}

/**
 * Get all account names (for UI display)
 */
export function getAccountNames(): string[] {
  const accounts = getAllAccounts();
  return Object.keys(accounts);
}

/**
 * Delete account
 */
export function deleteAccount(username: string): void {
  const normalizedUsername = normalizeUsername(username);
  const accounts = getAllAccounts();
  delete accounts[normalizedUsername];
  saveAccounts(accounts);

  // If deleting the active user, also log out
  if (getCurrentUser() === normalizedUsername) {
    logout();
  }
}

/**
 * Remove all accounts (app reset)
 */
export function clearAllAccounts(): void {
  localStorage.removeItem(ACCOUNTS_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

/**
 * Legacy compatibility helpers (deprecated)
 */
export async function setMasterPassword(password: string): Promise<void> {
  // Backward compatibility: create a default account
  const defaultUsername = 'default';
  if (!accountExists(defaultUsername)) {
    await createAccount(defaultUsername, password);
  }
}

export async function verifyMasterPassword(password: string): Promise<boolean> {
  const defaultUsername = 'default';
  if (accountExists(defaultUsername)) {
    return await verifyAccount(defaultUsername, password);
  }
  return true;
}

export function hasMasterPassword(): boolean {
  return getAccountNames().length > 0;
}

export function clearMasterPassword(): void {
  clearAllAccounts();
}
