/**
 * Data Models for "The Void"
 * These types drive the "Bamboo Scroll" UI and storage adapters
 */

export interface Note {
  id: string;          // UUID
  title: string;       // Visible title
  content: string;     // Markdown if public, Encrypted Base64 string if private
  isPrivate: boolean;  // Crucial: Determines if the "Cinnabar Red Dot" appears in the sidebar
  createdAt: number;
  updatedAt: number;
  // Optional organization metadata
  tags?: string[];
  folder?: string;
  trashed?: boolean;
  deletedAt?: number;
  // Desktop only: Refers to the actual file on disk
  fileHandle?: FileSystemFileHandle;
  // Private note password (only in memory after unlock, not persisted)
  notePassword?: string;
  // Optional content format hints (legacy HTML or markdown checksum/backup)
  contentFormat?: 'markdown' | 'html';
  contentChecksum?: string;
  contentHtml?: string;
}

/**
 * Vault Status drives visual states:
 * - LOCKED: "The Seal" is closed
 * - UNSEALING: Golden circle animation is completing (PBKDF2 derivation in progress)
 * - OPEN: Vault is accessible
 * - SEAL_BROKEN: Decryption failed - Triggers Cinnabar Red pulse animation
 * - ERROR: General error state
 */
export type VaultStatus = 'LOCKED' | 'UNSEALING' | 'OPEN' | 'SEAL_BROKEN' | 'ERROR';

/**
 * Encrypted payload structure
 * Stored as a JSON string in the note.content field when isPrivate=true
 */
export interface EncryptedPayload {
  iv: string;        // Base64-encoded initialization vector
  salt: string;      // Base64-encoded salt for key derivation
  data: string;      // Base64-encoded encrypted data
}

/**
 * Storage Adapter Interface - "The Dual Vessel"
 * Both Desktop (File System) and Mobile (IndexedDB) adapters must implement this
 */
export interface StorageAdapter {
  /**
   * Initialize the storage (connect to file system or open IndexedDB)
   */
  connect(): Promise<void>;

  /**
   * List all notes (metadata only - lazy loading)
   * Performance: Read only titles/metadata, NOT full content
   */
  listNotes(): Promise<Note[]>;

  /**
   * Read a specific note (full content)
   */
  readNote(id: string): Promise<Note | null>;

  /**
   * Write/update a note
   */
  writeNote(note: Note): Promise<void>;

  /**
   * Delete a note
   */
  deleteNote(id: string): Promise<void>;

  /**
   * Move a note to trash (soft delete)
   */
  moveToTrash(id: string): Promise<void>;

  /**
   * List trashed notes
   */
  listTrash(): Promise<Note[]>;

  /**
   * Restore a trashed note
   */
  restoreFromTrash(id: string): Promise<void>;

  /**
   * Permanently delete a trashed note
   */
  purgeFromTrash(id: string): Promise<void>;

  /**
   * Save a version snapshot for a note
   */
  saveVersion(note: Note): Promise<void>;

  /**
   * List recent versions for a note
   */
  listVersions(id: string): Promise<NoteVersion[]>;

  /**
   * Save an attachment and return its asset id
   */
  saveAttachment(file: File): Promise<string>;

  /**
   * Read an attachment blob by asset id
   */
  readAttachment(assetId: string): Promise<Blob | null>;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  createdAt: number;
  title: string;
  content: string;
  isPrivate: boolean;
  tags?: string[];
  folder?: string;
  contentFormat?: 'markdown' | 'html';
  contentChecksum?: string;
}

/**
 * Device detection result
 */
export interface DeviceCapabilities {
  isMobile: boolean;
  supportsFileSystem: boolean;
  adapterType: 'filesystem' | 'indexeddb';
}
