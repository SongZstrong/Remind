/**
 * The Unified Store - "The Brain Core"
 * Global state management using Zustand
 * Bridges UI components with storage adapters
 */

import { create } from 'zustand';
import type { Note, VaultStatus, DeviceCapabilities } from '@/types/void';
import { encryptNote, decryptNote, generateFingerprintFromPassword } from '@/utils/seal-engine';
import { htmlToMarkdown, looksLikeHtml, markdownToHtml } from '@/utils/markdown';
import { resolveAssetUrls } from '@/utils/asset-resolver';
import { hashString } from '@/utils/note-serialization';

interface VoidStore {
  // State
  notes: Note[];
  activeNote: Note | null;
  vaultStatus: VaultStatus;
  device: DeviceCapabilities;
  keyFingerprint: number[] | null;
  masterPassword: string | null;

  // Storage adapter reference (set by openVoid)
  storageAdapter: any;

  // Actions
  detectDevice: () => void;
  openVoid: (adapter: any) => Promise<void>;
  loadNotes: () => Promise<void>;
  selectNote: (id: string) => Promise<void>;
  createNote: (
    title: string,
    isPrivate: boolean,
    notePassword?: string,
    createdAt?: number
  ) => Promise<void>;
  saveNote: (note: Note) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  unlockSanctum: (noteId: string, password: string) => Promise<void>;
  setMasterPassword: (password: string) => Promise<void>;
  generateFingerprint: (password: string) => Promise<void>;
  lockVault: () => void;
  clearActiveNote: () => void;
}

export const useVoidStore = create<VoidStore>((set, get) => ({
  // Initial State
  notes: [],
  activeNote: null,
  vaultStatus: 'LOCKED',
  device: {
    isMobile: false,
    supportsFileSystem: false,
    adapterType: 'indexeddb',
  },
  keyFingerprint: null,
  masterPassword: null,
  storageAdapter: null,

  /**
   * Detect device capabilities
   * Determines which adapter to use (File System or IndexedDB)
   */
  detectDevice: () => {
    if (typeof window === 'undefined') {
      return;
    }

    const supportsFileSystem = 'showDirectoryPicker' in window;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    set({
      device: {
        isMobile,
        supportsFileSystem,
        adapterType: supportsFileSystem ? 'filesystem' : 'indexeddb',
      },
    });
  },

  /**
   * Open the Void (Initialize storage)
   * @param adapter - Either useFileSystem or useLocalVault hook result
   */
  openVoid: async (adapter: any) => {
    try {
      set({ vaultStatus: 'UNSEALING' });

      // Connect to storage
      await adapter.connect();

      // Store adapter reference
      set({
        storageAdapter: adapter,
        vaultStatus: 'OPEN',
      });

      // Load notes metadata
      await get().loadNotes();
    } catch (error) {
      console.error('Failed to open void:', error);
      set({ vaultStatus: 'ERROR' });
      throw error;
    }
  },

  /**
   * Load all notes (metadata only - lazy loading)
   */
  loadNotes: async () => {
    const { storageAdapter } = get();
    if (!storageAdapter) {
      throw new Error('No storage adapter connected');
    }

    try {
      const notes = await storageAdapter.listNotes();
      set({ notes });
    } catch (error) {
      console.error('Failed to load notes:', error);
      throw error;
    }
  },

  /**
   * Select and load a note (full content)
   * @param id - Note ID
   */
  selectNote: async (id: string) => {
    const { storageAdapter } = get();
    if (!storageAdapter) {
      throw new Error('No storage adapter connected');
    }

    try {
      const note = await storageAdapter.readNote(id);
      if (note) {
        if (note.isPrivate) {
          set({ activeNote: note });
        } else {
          const contentFormat = note.contentFormat
            ?? (looksLikeHtml(note.content) ? 'html' : 'markdown');
          const checksumMatches = Boolean(
            note.contentHtml &&
              note.contentChecksum &&
              note.contentChecksum === hashString(note.content)
          );
          let contentHtml = contentFormat === 'html'
            ? note.content
            : checksumMatches
            ? note.contentHtml || ''
            : markdownToHtml(note.content);

          if (storageAdapter.readAttachment) {
            contentHtml = await resolveAssetUrls(contentHtml, storageAdapter.readAttachment);
          }

          set({
            activeNote: {
              ...note,
              content: contentHtml,
              contentFormat,
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to select note:', error);
      throw error;
    }
  },

  /**
   * Create a new note
   */
  createNote: async (
    title: string,
    isPrivate: boolean,
    notePassword?: string,
    createdAt?: number
  ) => {
    const { storageAdapter } = get();
    if (!storageAdapter) {
      throw new Error('No storage adapter connected');
    }

    try {
      if (isPrivate && !notePassword) {
        throw new Error('NOTE_PASSWORD_REQUIRED');
      }

      const now = createdAt ?? Date.now();
      const id = `${now}-${Math.random().toString(36).slice(2, 9)}.md`;
      const markdownContent = '';
      let storageContent = markdownContent;
      const contentChecksum = hashString(markdownContent);

      // If private, store encrypted content on disk but keep plaintext in memory
      if (isPrivate && notePassword) {
        storageContent = await encryptNote(markdownContent, notePassword);
      }

      const noteForStorage: Note = {
        id,
        title,
        content: storageContent,
        isPrivate,
        createdAt: now,
        updatedAt: now,
        tags: [],
        folder: '',
        contentFormat: 'markdown',
        contentChecksum,
      };

      await storageAdapter.writeNote(noteForStorage);
      await get().loadNotes();

      // Select the new note
      const noteForState: Note = {
        ...noteForStorage,
        content: '',
        notePassword: isPrivate ? notePassword : undefined,
      };
      set({ activeNote: noteForState });
    } catch (error) {
      console.error('Failed to create note:', error);
      throw error;
    }
  },

  /**
   * Save a note (handles encryption if private)
   */
  saveNote: async (note: Note) => {
    const { storageAdapter } = get();
    if (!storageAdapter) {
      throw new Error('No storage adapter connected');
    }

    try {
      const updatedNote = { ...note, updatedAt: Date.now() };

      if (note.isPrivate && !note.notePassword) {
        throw new Error('NOTE_PASSWORD_REQUIRED');
      }

      const markdownContent = htmlToMarkdown(note.content);
      const contentChecksum = hashString(markdownContent);

      if (note.isPrivate && note.notePassword) {
        const encryptedContent = await encryptNote(markdownContent, note.notePassword);
        const { notePassword, ...noteToSave } = {
          ...updatedNote,
          content: encryptedContent,
          contentFormat: 'markdown',
          contentChecksum,
          contentHtml: undefined,
        };
        await storageAdapter.writeNote(noteToSave);
        await storageAdapter.saveVersion(noteToSave);
      } else {
        const { notePassword, ...noteToSave } = {
          ...updatedNote,
          content: markdownContent,
          contentFormat: 'markdown',
          contentChecksum,
          contentHtml: note.content,
        };
        await storageAdapter.writeNote(noteToSave);
        await storageAdapter.saveVersion(noteToSave);
      }

      await get().loadNotes();

      // Update active note if it's the same one (keep password in memory)
      const { activeNote } = get();
      if (activeNote?.id === note.id) {
        set({
          activeNote: {
            ...updatedNote,
            contentFormat: 'markdown',
            contentChecksum,
            contentHtml: note.isPrivate ? undefined : note.content,
          },
        });
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      throw error;
    }
  },

  /**
   * Delete a note
   */
  deleteNote: async (id: string) => {
    const { storageAdapter, activeNote } = get();
    if (!storageAdapter) {
      throw new Error('No storage adapter connected');
    }

    try {
      await storageAdapter.deleteNote(id);
      await get().loadNotes();

      // Clear active note if it was deleted
      if (activeNote?.id === id) {
        set({ activeNote: null });
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw error;
    }
  },

  /**
   * Unlock a private note (decrypt content)
   * @param noteId - Note to unlock
   * @param password - Decryption password
   *
   * Visual Integration:
   * - Sets vaultStatus to 'UNSEALING' → Golden circle animation plays
   * - If success: Content decrypted
   * - If fail: Sets vaultStatus to 'SEAL_BROKEN' → Cinnabar Red pulse
   */
  unlockSanctum: async (noteId: string, password: string) => {
    const { activeNote, storageAdapter } = get();

    if (!activeNote || activeNote.id !== noteId) {
      throw new Error('Note not loaded');
    }

    try {
      // Set status to UNSEALING - triggers animation
      set({ vaultStatus: 'UNSEALING' });

      // Attempt decryption (PBKDF2 delay allows animation to complete)
      const decryptedContent = await decryptNote(activeNote.content, password);
      const contentFormat = activeNote.contentFormat
        ?? (looksLikeHtml(decryptedContent) ? 'html' : 'markdown');
      let contentHtml =
        contentFormat === 'html' ? decryptedContent : markdownToHtml(decryptedContent);

      if (storageAdapter?.readAttachment) {
        contentHtml = await resolveAssetUrls(contentHtml, storageAdapter.readAttachment);
      }

      // Success - update active note with decrypted content and password
      set({
        activeNote: {
          ...activeNote,
          content: contentHtml,
          notePassword: password, // Store note password in memory
          contentFormat,
          contentChecksum: hashString(
            contentFormat === 'html' ? htmlToMarkdown(contentHtml) : decryptedContent
          ),
        },
        vaultStatus: 'OPEN',
      });
    } catch (error) {
      // Decryption failed - trigger SEAL_BROKEN animation
      if ((error as Error).message === 'SEAL_BROKEN') {
        set({ vaultStatus: 'SEAL_BROKEN' });

        // Reset to LOCKED after animation completes (1.5s)
        setTimeout(() => {
          set({ vaultStatus: 'LOCKED' });
        }, 1500);
      } else {
        set({ vaultStatus: 'ERROR' });
      }
      throw error;
    }
  },

  /**
   * Set master password for encrypting new notes
   */
  setMasterPassword: async (password: string) => {
    set({ masterPassword: password });
    await get().generateFingerprint(password);
  },

  /**
   * Generate visual fingerprint from password
   * Used for "Star Map" visualization
   */
  generateFingerprint: async (password: string) => {
    try {
      const fingerprint = await generateFingerprintFromPassword(password);
      set({ keyFingerprint: fingerprint });
    } catch (error) {
      console.error('Failed to generate fingerprint:', error);
    }
  },

  /**
   * Lock the vault
   */
  lockVault: () => {
    set({
      vaultStatus: 'LOCKED',
      masterPassword: null,
      activeNote: null,
      notes: [],
      keyFingerprint: null,
      storageAdapter: null,
    });
  },

  clearActiveNote: () => {
    set({ activeNote: null });
  },
}));
