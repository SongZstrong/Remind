/**
 * Mobile Adapter - "The Wanderer"
 * Uses IndexedDB for browser-based storage when File System API is unavailable
 *
 * Account isolation: each account uses an independent note key prefix
 *
 * Graceful Degradation:
 * - On mobile, this adapter silently takes over
 * - User enters "The Void" immediately without error messages
 */

import { useCallback } from 'react';
import { get, set, del, keys } from 'idb-keyval';
import type { Note, NoteVersion, StorageAdapter } from '@/types/void';
import { getCurrentUser } from '@/utils/password-manager';

function getNotePrefix(): string {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('NO_CURRENT_USER');
  }
  return `void-note:${currentUser}:`;
}

function getVersionKey(noteId: string): string {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('NO_CURRENT_USER');
  }
  return `void-version:${currentUser}:${noteId}`;
}

function getAssetKey(assetId: string): string {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('NO_CURRENT_USER');
  }
  return `void-asset:${currentUser}:${assetId}`;
}

const maxVersions = 5;

export function useLocalVault(): StorageAdapter & {
  isSupported: boolean;
  fallbackCheck: () => boolean;
} {
  // IndexedDB is available in all modern browsers
  const isSupported = typeof window !== 'undefined' && 'indexedDB' in window;

  /**
   * Check if we need to fallback to IndexedDB
   * Returns true if File System API is not available
   */
  const fallbackCheck = useCallback((): boolean => {
    return typeof window === 'undefined' || !('showDirectoryPicker' in window);
  }, []);

  /**
   * Initialize IndexedDB
   * No user interaction required - silently opens database
   */
  const connect = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      throw new Error('IndexedDB not supported');
    }

    // idb-keyval auto-initializes on first use
    // We just verify it's working
    try {
      await keys(); // Test connection
    } catch (error) {
      console.error('Failed to connect to IndexedDB:', error);
      throw new Error('INDEXEDDB_INIT_FAILED');
    }
  }, [isSupported]);

  /**
   * List all notes from IndexedDB (metadata only)
   * Account isolation: only return notes for the active account
   */
  const listNotes = useCallback(async (): Promise<Note[]> => {
    try {
      const notePrefix = getNotePrefix();
      const allKeys = await keys();
      const noteKeys = allKeys.filter(key =>
        typeof key === 'string' && key.startsWith(notePrefix)
      );

      const notes: Note[] = [];

      for (const key of noteKeys) {
        const note = await get<Note>(key);
        if (note && !note.trashed) {
          // Return metadata only (clear content for lazy loading)
          notes.push({
            ...note,
            content: '', // Will be loaded on demand
            contentHtml: undefined,
            contentChecksum: undefined,
          });
        }
      }

      // Sort by updatedAt (newest first)
      return notes.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('Failed to list notes:', error);
      return [];
    }
  }, []);

  /**
   * Read a specific note with full content
   */
  const readNote = useCallback(async (id: string): Promise<Note | null> => {
    try {
      const notePrefix = getNotePrefix();
      const key = `${notePrefix}${id}`;
      const note = await get<Note>(key);
      return note || null;
    } catch (error) {
      console.error('Failed to read note:', error);
      return null;
    }
  }, []);

  /**
   * Write/update a note to IndexedDB
   */
  const writeNote = useCallback(async (note: Note): Promise<void> => {
    try {
      const notePrefix = getNotePrefix();
      const key = `${notePrefix}${note.id}`;
      await set(key, {
        ...note,
        updatedAt: Date.now(), // Update timestamp
      });
    } catch (error) {
      console.error('Failed to write note:', error);
      throw new Error('WRITE_FAILED');
    }
  }, []);

  /**
   * Delete a note from IndexedDB
   */
  const deleteNote = useCallback(async (id: string): Promise<void> => {
    try {
      const notePrefix = getNotePrefix();
      const key = `${notePrefix}${id}`;
      await del(key);
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw new Error('DELETE_FAILED');
    }
  }, []);

  /**
   * Move a note to trash
   */
  const moveToTrash = useCallback(async (id: string): Promise<void> => {
    try {
      const notePrefix = getNotePrefix();
      const key = `${notePrefix}${id}`;
      const note = await get<Note>(key);
      if (!note) {
        return;
      }
      await set(key, {
        ...note,
        trashed: true,
        deletedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to move note to trash:', error);
      throw new Error('TRASH_FAILED');
    }
  }, []);

  /**
   * List trashed notes
   */
  const listTrash = useCallback(async (): Promise<Note[]> => {
    try {
      const notePrefix = getNotePrefix();
      const allKeys = await keys();
      const noteKeys = allKeys.filter(key =>
        typeof key === 'string' && key.startsWith(notePrefix)
      );

      const notes: Note[] = [];

      for (const key of noteKeys) {
        const note = await get<Note>(key);
        if (note && note.trashed) {
          notes.push({
            ...note,
            content: '',
            contentHtml: undefined,
            contentChecksum: undefined,
          });
        }
      }

      return notes.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    } catch (error) {
      console.error('Failed to list trashed notes:', error);
      return [];
    }
  }, []);

  /**
   * Restore a trashed note
   */
  const restoreFromTrash = useCallback(async (id: string): Promise<void> => {
    try {
      const notePrefix = getNotePrefix();
      const key = `${notePrefix}${id}`;
      const note = await get<Note>(key);
      if (!note) {
        return;
      }
      await set(key, {
        ...note,
        trashed: false,
        deletedAt: undefined,
      });
    } catch (error) {
      console.error('Failed to restore note from trash:', error);
      throw new Error('RESTORE_FAILED');
    }
  }, []);

  /**
   * Permanently delete a trashed note
   */
  const purgeFromTrash = useCallback(async (id: string): Promise<void> => {
    try {
      const notePrefix = getNotePrefix();
      const key = `${notePrefix}${id}`;
      await del(key);
    } catch (error) {
      console.error('Failed to purge trashed note:', error);
      throw new Error('PURGE_FAILED');
    }
  }, []);

  /**
   * Save a version snapshot
   */
  const saveVersion = useCallback(async (note: Note): Promise<void> => {
    try {
      const versionKey = getVersionKey(note.id);
      const existing = (await get<NoteVersion[]>(versionKey)) ?? [];
      const newVersion: NoteVersion = {
        id: `${Date.now()}`,
        noteId: note.id,
        createdAt: Date.now(),
        title: note.title,
        content: note.content,
        isPrivate: note.isPrivate,
        tags: note.tags,
        folder: note.folder,
        contentFormat: note.contentFormat,
        contentChecksum: note.contentChecksum,
      };
      const updated = [newVersion, ...existing].slice(0, maxVersions);
      await set(versionKey, updated);
    } catch (error) {
      console.error('Failed to save version snapshot:', error);
    }
  }, []);

  /**
   * List versions for a note
   */
  const listVersions = useCallback(async (id: string): Promise<NoteVersion[]> => {
    try {
      const versionKey = getVersionKey(id);
      const versions = (await get<NoteVersion[]>(versionKey)) ?? [];
      return versions.sort((a, b) => b.createdAt - a.createdAt).slice(0, maxVersions);
    } catch (error) {
      console.error('Failed to list versions:', error);
      return [];
    }
  }, []);

  /**
   * Save attachment in IndexedDB
   */
  const saveAttachment = useCallback(async (file: File): Promise<string> => {
    try {
      const extensionMatch = file.name.match(/\.[a-z0-9]+$/i);
      const extension = extensionMatch ? extensionMatch[0] : '';
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
      const key = getAssetKey(assetId);
      await set(key, file);
      return assetId;
    } catch (error) {
      console.error('Failed to save attachment:', error);
      throw new Error('ATTACHMENT_SAVE_FAILED');
    }
  }, []);

  /**
   * Read attachment blob from IndexedDB
   */
  const readAttachment = useCallback(async (assetId: string): Promise<Blob | null> => {
    try {
      const key = getAssetKey(assetId);
      const blob = await get<Blob>(key);
      return blob ?? null;
    } catch (error) {
      console.error('Failed to read attachment:', error);
      return null;
    }
  }, []);

  return {
    isSupported,
    fallbackCheck,
    connect,
    listNotes,
    readNote,
    writeNote,
    deleteNote,
    moveToTrash,
    listTrash,
    restoreFromTrash,
    purgeFromTrash,
    saveVersion,
    listVersions,
    saveAttachment,
    readAttachment,
  };
}
