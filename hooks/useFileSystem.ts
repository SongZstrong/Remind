/**
 * Desktop Adapter - "The Anchor"
 * Uses File System Access API for direct disk read/write
 *
 * Account isolation: each account stores notes in a separate subfolder
 *
 * Lazy Loading Strategy:
 * - listNotes() reads only filenames/metadata
 * - Full content loaded only when user clicks a Pill
 */

import { useState, useCallback, useRef } from 'react';
import type { Note, NoteVersion, StorageAdapter } from '@/types/void';
import { getCurrentUser } from '@/utils/password-manager';
import { looksLikeHtml } from '@/utils/markdown';
import {
  extractHtmlBackup,
  isEncryptedPayload,
  parseNoteFile,
  serializeNoteFile,
  hashString,
} from '@/utils/note-serialization';

export function useFileSystem(): StorageAdapter & {
  isSupported: boolean;
  directoryHandle: FileSystemDirectoryHandle | null;
} {
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const maxVersions = 5;

  // Check if File System Access API is supported
  const isSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  /**
   * Get the current user's directory handle
   * Each user has an isolated subfolder
   */
  const getUserDirectoryHandle = useCallback(async (
    rootHandle: FileSystemDirectoryHandle
  ): Promise<FileSystemDirectoryHandle> => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('NO_CURRENT_USER');
    }
    const userFolderName = `user-${currentUser}`;

    try {
      // Get or create user folder
      const userHandle = await rootHandle.getDirectoryHandle(userFolderName, { create: true });
      return userHandle;
    } catch (error) {
      console.error('Failed to get user directory:', error);
      throw error;
    }
  }, []);

  const getMetaDirectoryHandle = useCallback(async (
    userHandle: FileSystemDirectoryHandle
  ): Promise<FileSystemDirectoryHandle> => {
    return userHandle.getDirectoryHandle('.remind', { create: true });
  }, []);

  const getTrashDirectoryHandle = useCallback(async (
    userHandle: FileSystemDirectoryHandle
  ): Promise<FileSystemDirectoryHandle> => {
    const metaHandle = await getMetaDirectoryHandle(userHandle);
    return metaHandle.getDirectoryHandle('trash', { create: true });
  }, [getMetaDirectoryHandle]);

  const getVersionsDirectoryHandle = useCallback(async (
    userHandle: FileSystemDirectoryHandle
  ): Promise<FileSystemDirectoryHandle> => {
    const metaHandle = await getMetaDirectoryHandle(userHandle);
    return metaHandle.getDirectoryHandle('versions', { create: true });
  }, [getMetaDirectoryHandle]);

  const getAssetsDirectoryHandle = useCallback(async (
    userHandle: FileSystemDirectoryHandle
  ): Promise<FileSystemDirectoryHandle> => {
    const metaHandle = await getMetaDirectoryHandle(userHandle);
    return metaHandle.getDirectoryHandle('assets', { create: true });
  }, [getMetaDirectoryHandle]);

  /**
   * Connect to user's local directory
   * Triggers showDirectoryPicker() - User selects vault folder
   */
  const connect = useCallback(async () => {
    if (!isSupported) {
      throw new Error('File System Access API not supported');
    }

    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        id: 'void-vault', // Browser remembers this folder
      });
      directoryHandleRef.current = handle;
      setDirectoryHandle(handle);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled - this is okay
        throw new Error('VAULT_ACCESS_DENIED');
      }
      throw error;
    }
  }, [isSupported]);

  /**
   * List all .md files (metadata only - lazy loading)
   * Account isolation: only return notes in the current user's folder
   */
  const listNotes = useCallback(async (): Promise<Note[]> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    const notes: Note[] = [];
    const previewSize = 8192;

    try {
      // Get current user's folder
      const userDirHandle = await getUserDirectoryHandle(activeHandle);

      // @ts-ignore - TypeScript types for async iteration might be incomplete
      for await (const entry of userDirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();

          const fallbackTitle = entry.name.replace(/\.md$/, '');
          let title = fallbackTitle;
          let isPrivate = false;
          let createdAt = file.lastModified;
          let updatedAt = file.lastModified;
          let tags: string[] | undefined;
          let folder: string | undefined;

          try {
            const preview = await file.slice(0, previewSize).text();
            const parsed = parseNoteFile(preview);
            if (parsed.frontMatter.trashed) {
              continue;
            }
            title = parsed.frontMatter.title || fallbackTitle;
            createdAt = parsed.frontMatter.createdAt ?? createdAt;
            updatedAt = parsed.frontMatter.updatedAt ?? updatedAt;
            tags = parsed.frontMatter.tags;
            folder = parsed.frontMatter.folder;
            const encryptedByPayload = isEncryptedPayload(parsed.body);
            if (typeof parsed.frontMatter.isPrivate === 'boolean') {
              isPrivate = parsed.frontMatter.isPrivate || encryptedByPayload;
            } else {
              isPrivate = encryptedByPayload;
            }
          } catch (error) {
            console.error('Failed to parse note metadata:', error);
          }

          notes.push({
            id: entry.name, // Use filename as ID
            title,
            content: '', // Empty - will be loaded on demand
            isPrivate,
            createdAt,
            updatedAt,
            tags,
            folder,
            fileHandle: entry as FileSystemFileHandle,
          });
        }
      }
    } catch (error) {
      console.error('Failed to list user notes:', error);
    }

    // Sort by updatedAt (newest first)
    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [getUserDirectoryHandle]);

  /**
   * Read full content of a specific note
   */
  const readNote = useCallback(async (id: string): Promise<Note | null> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      const fileHandle = await userDirHandle.getFileHandle(id);
      const file = await fileHandle.getFile();
      const content = await file.text();

      const fallbackTitle = id.replace(/\.md$/, '');
      const parsed = parseNoteFile(content);
      const frontMatter = parsed.frontMatter;
      const title = frontMatter.title || fallbackTitle;
      let body = parsed.body;
      const encryptedByPayload = isEncryptedPayload(body);
      const encrypted = typeof frontMatter.isPrivate === 'boolean'
        ? frontMatter.isPrivate || encryptedByPayload
        : encryptedByPayload;

      let contentFormat = frontMatter.format;
      let contentHtml: string | undefined;
      let contentChecksum = frontMatter.checksum;

      if (!encrypted) {
        const extracted = extractHtmlBackup(body);
        body = extracted.markdown;
        contentHtml = extracted.htmlBackup;
        if (!contentChecksum && contentHtml) {
          contentChecksum = hashString(body);
        }
        if (!contentFormat) {
          contentFormat = looksLikeHtml(body) ? 'html' : 'markdown';
        }
      } else if (!contentFormat) {
        contentFormat = 'markdown';
      }

      return {
        id,
        title,
        content: body,
        isPrivate: encrypted,
        createdAt: frontMatter.createdAt ?? file.lastModified,
        updatedAt: frontMatter.updatedAt ?? file.lastModified,
        tags: frontMatter.tags,
        folder: frontMatter.folder,
        trashed: frontMatter.trashed,
        deletedAt: frontMatter.deletedAt,
        fileHandle,
        contentFormat,
        contentHtml,
        contentChecksum,
      };
    } catch (error) {
      console.error('Failed to read note:', error);
      return null;
    }
  }, [getUserDirectoryHandle]);

  /**
   * Write/update a note to disk
   */
  const writeNote = useCallback(async (note: Note): Promise<void> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);

      // Ensure filename has .md extension
      const filename = note.id.endsWith('.md') ? note.id : `${note.id}.md`;

      const fileHandle = await userDirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();

      const fileBody = serializeNoteFile(note, note.content, {
        format: note.contentFormat ?? 'markdown',
        encrypted: note.isPrivate,
        checksum: note.contentChecksum,
        htmlBackup: note.isPrivate ? undefined : note.contentHtml,
      });

      await writable.write(fileBody);
      await writable.close();
    } catch (error) {
      console.error('Failed to write note:', error);
      throw new Error('WRITE_FAILED');
    }
  }, [getUserDirectoryHandle]);

  /**
   * Delete a note from disk
   */
  const deleteNote = useCallback(async (id: string): Promise<void> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      await userDirHandle.removeEntry(id);
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw new Error('DELETE_FAILED');
    }
  }, [getUserDirectoryHandle]);

  /**
   * Move a note to trash
   */
  const moveToTrash = useCallback(async (id: string): Promise<void> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      const note = await readNote(id);
      if (!note) {
        throw new Error('NOTE_NOT_FOUND');
      }

      const trashDirHandle = await getTrashDirectoryHandle(userDirHandle);
      const trashedNote: Note = {
        ...note,
        trashed: true,
        deletedAt: Date.now(),
      };
      const fileHandle = await trashDirHandle.getFileHandle(id, { create: true });
      const writable = await fileHandle.createWritable();
      const fileBody = serializeNoteFile(trashedNote, trashedNote.content, {
        format: trashedNote.contentFormat ?? 'markdown',
        encrypted: trashedNote.isPrivate,
        checksum: trashedNote.contentChecksum,
        htmlBackup: trashedNote.isPrivate ? undefined : trashedNote.contentHtml,
      });
      await writable.write(fileBody);
      await writable.close();

      await userDirHandle.removeEntry(id);
    } catch (error) {
      console.error('Failed to move note to trash:', error);
      throw new Error('TRASH_FAILED');
    }
  }, [getUserDirectoryHandle, getTrashDirectoryHandle, readNote]);

  /**
   * List trashed notes
   */
  const listTrash = useCallback(async (): Promise<Note[]> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    const notes: Note[] = [];
    const previewSize = 8192;

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      const trashDirHandle = await getTrashDirectoryHandle(userDirHandle);

      // @ts-ignore - TypeScript types for async iteration might be incomplete
      for await (const entry of trashDirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();

          const fallbackTitle = entry.name.replace(/\.md$/, '');
          let title = fallbackTitle;
          let isPrivate = false;
          let createdAt = file.lastModified;
          let updatedAt = file.lastModified;
          let tags: string[] | undefined;
          let folder: string | undefined;
          let deletedAt = file.lastModified;

          try {
            const preview = await file.slice(0, previewSize).text();
            const parsed = parseNoteFile(preview);
            title = parsed.frontMatter.title || fallbackTitle;
            createdAt = parsed.frontMatter.createdAt ?? createdAt;
            updatedAt = parsed.frontMatter.updatedAt ?? updatedAt;
            tags = parsed.frontMatter.tags;
            folder = parsed.frontMatter.folder;
            deletedAt = parsed.frontMatter.deletedAt ?? deletedAt;
            const encryptedByPayload = isEncryptedPayload(parsed.body);
            if (typeof parsed.frontMatter.isPrivate === 'boolean') {
              isPrivate = parsed.frontMatter.isPrivate || encryptedByPayload;
            } else {
              isPrivate = encryptedByPayload;
            }
          } catch (error) {
            console.error('Failed to parse trashed note metadata:', error);
          }

          notes.push({
            id: entry.name,
            title,
            content: '',
            isPrivate,
            createdAt,
            updatedAt,
            tags,
            folder,
            trashed: true,
            deletedAt,
            fileHandle,
          });
        }
      }
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        return [];
      }
      console.error('Failed to list trashed notes:', error);
    }

    return notes.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }, [getUserDirectoryHandle, getTrashDirectoryHandle]);

  /**
   * Restore a note from trash
   */
  const restoreFromTrash = useCallback(async (id: string): Promise<void> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      const trashDirHandle = await getTrashDirectoryHandle(userDirHandle);
      const fileHandle = await trashDirHandle.getFileHandle(id);
      const file = await fileHandle.getFile();
      const content = await file.text();

      const parsed = parseNoteFile(content);
      const fallbackTitle = id.replace(/\.md$/, '');
      let body = parsed.body;
      const encryptedByPayload = isEncryptedPayload(body);
      const encrypted = typeof parsed.frontMatter.isPrivate === 'boolean'
        ? parsed.frontMatter.isPrivate || encryptedByPayload
        : encryptedByPayload;
      let contentFormat = parsed.frontMatter.format;
      let contentHtml: string | undefined;
      let contentChecksum = parsed.frontMatter.checksum;

      if (!encrypted) {
        const extracted = extractHtmlBackup(body);
        body = extracted.markdown;
        contentHtml = extracted.htmlBackup;
        if (!contentChecksum && contentHtml) {
          contentChecksum = hashString(body);
        }
        if (!contentFormat) {
          contentFormat = looksLikeHtml(body) ? 'html' : 'markdown';
        }
      } else if (!contentFormat) {
        contentFormat = 'markdown';
      }

      const note: Note = {
        id,
        title: parsed.frontMatter.title ?? fallbackTitle,
        content: body,
        isPrivate: encrypted,
        createdAt: parsed.frontMatter.createdAt ?? file.lastModified,
        updatedAt: parsed.frontMatter.updatedAt ?? file.lastModified,
        tags: parsed.frontMatter.tags,
        folder: parsed.frontMatter.folder,
        trashed: false,
        deletedAt: undefined,
        contentFormat,
        contentHtml,
        contentChecksum,
      };

      const restoredNote: Note = {
        ...note,
        trashed: false,
        deletedAt: undefined,
      };

      const restoredHandle = await userDirHandle.getFileHandle(id, { create: true });
      const writable = await restoredHandle.createWritable();
      const fileBody = serializeNoteFile(restoredNote, restoredNote.content, {
        format: restoredNote.contentFormat ?? 'markdown',
        encrypted: restoredNote.isPrivate,
        checksum: restoredNote.contentChecksum,
        htmlBackup: restoredNote.isPrivate ? undefined : restoredNote.contentHtml,
      });
      await writable.write(fileBody);
      await writable.close();

      await trashDirHandle.removeEntry(id);
    } catch (error) {
      console.error('Failed to restore note from trash:', error);
      throw new Error('RESTORE_FAILED');
    }
  }, [getUserDirectoryHandle, getTrashDirectoryHandle]);

  /**
   * Permanently delete a trashed note
   */
  const purgeFromTrash = useCallback(async (id: string): Promise<void> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      const trashDirHandle = await getTrashDirectoryHandle(userDirHandle);
      await trashDirHandle.removeEntry(id);
    } catch (error) {
      console.error('Failed to purge trashed note:', error);
      throw new Error('PURGE_FAILED');
    }
  }, [getUserDirectoryHandle, getTrashDirectoryHandle]);

  /**
   * Save a version snapshot
   */
  const saveVersion = useCallback(async (note: Note): Promise<void> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      const versionsDirHandle = await getVersionsDirectoryHandle(userDirHandle);
      const noteDirHandle = await versionsDirHandle.getDirectoryHandle(note.id, { create: true });
      const versionId = `${Date.now()}.md`;
      const fileHandle = await noteDirHandle.getFileHandle(versionId, { create: true });
      const writable = await fileHandle.createWritable();
      const fileBody = serializeNoteFile(note, note.content, {
        format: note.contentFormat ?? 'markdown',
        encrypted: note.isPrivate,
        checksum: note.contentChecksum,
        htmlBackup: note.isPrivate ? undefined : note.contentHtml,
      });
      await writable.write(fileBody);
      await writable.close();

      const entries: FileSystemFileHandle[] = [];
      // @ts-ignore - TypeScript types for async iteration might be incomplete
      for await (const entry of noteDirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          entries.push(entry as FileSystemFileHandle);
        }
      }

      const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
      if (sorted.length > maxVersions) {
        const excess = sorted.slice(0, sorted.length - maxVersions);
        for (const entry of excess) {
          await noteDirHandle.removeEntry(entry.name);
        }
      }
    } catch (error) {
      console.error('Failed to save version snapshot:', error);
    }
  }, [getUserDirectoryHandle, getVersionsDirectoryHandle]);

  /**
   * List recent versions
   */
  const listVersions = useCallback(async (id: string): Promise<NoteVersion[]> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      const versionsDirHandle = await getVersionsDirectoryHandle(userDirHandle);
      const noteDirHandle = await versionsDirHandle.getDirectoryHandle(id);

      const versions: NoteVersion[] = [];
      // @ts-ignore - TypeScript types for async iteration might be incomplete
      for await (const entry of noteDirHandle.values()) {
        if (entry.kind !== 'file' || !entry.name.endsWith('.md')) {
          continue;
        }
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const content = await file.text();
        const parsed = parseNoteFile(content);

        const createdAt = Number(entry.name.replace(/\.md$/, '')) || parsed.frontMatter.updatedAt || file.lastModified;
        versions.push({
          id: entry.name,
          noteId: id,
          createdAt,
          title: parsed.frontMatter.title ?? id.replace(/\.md$/, ''),
          content: parsed.body,
          isPrivate: parsed.frontMatter.isPrivate ?? false,
          tags: parsed.frontMatter.tags,
          folder: parsed.frontMatter.folder,
          contentFormat: parsed.frontMatter.format,
          contentChecksum: parsed.frontMatter.checksum,
        });
      }

      return versions.sort((a, b) => b.createdAt - a.createdAt).slice(0, maxVersions);
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        return [];
      }
      console.error('Failed to list versions:', error);
      return [];
    }
  }, [getUserDirectoryHandle, getVersionsDirectoryHandle]);

  /**
   * Save an attachment file to the vault assets directory
   */
  const saveAttachment = useCallback(async (file: File): Promise<string> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      const assetsDirHandle = await getAssetsDirectoryHandle(userDirHandle);

      const extensionMatch = file.name.match(/\.[a-z0-9]+$/i);
      const extension = extensionMatch ? extensionMatch[0] : '';
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;

      const fileHandle = await assetsDirHandle.getFileHandle(assetId, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();

      return assetId;
    } catch (error) {
      console.error('Failed to save attachment:', error);
      throw new Error('ATTACHMENT_SAVE_FAILED');
    }
  }, [getUserDirectoryHandle, getAssetsDirectoryHandle]);

  /**
   * Read an attachment blob
   */
  const readAttachment = useCallback(async (assetId: string): Promise<Blob | null> => {
    const activeHandle = directoryHandleRef.current;
    if (!activeHandle) {
      throw new Error('Not connected to file system');
    }

    try {
      const userDirHandle = await getUserDirectoryHandle(activeHandle);
      const assetsDirHandle = await getAssetsDirectoryHandle(userDirHandle);
      const fileHandle = await assetsDirHandle.getFileHandle(assetId);
      const file = await fileHandle.getFile();
      return file;
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        return null;
      }
      console.error('Failed to read attachment:', error);
      return null;
    }
  }, [getUserDirectoryHandle, getAssetsDirectoryHandle]);

  return {
    isSupported,
    directoryHandle,
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
