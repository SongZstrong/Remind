/**
 * The Bamboo Scroll - Main Workspace
 * Visual Goal: Harmony between list and editor
 */

'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Lock, Unlock, Circle, Edit3, Trash2, Save, AlertCircle, Sun, Moon, User, LogOut, Flame, Search, History, Download, Archive } from 'lucide-react';
import { useVoidStore } from '@/store/void-store';
import { useThemeStore } from '@/store/theme-store';
import { ZenButton } from '@/components/ui/ZenButton';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { getCurrentUser, logout } from '@/utils/password-manager';
import { looksLikeHtml, markdownToHtml } from '@/utils/markdown';
import { decryptNote } from '@/utils/seal-engine';
import { serializeNoteFile, parseNoteFile, extractHtmlBackup, isEncryptedPayload, hashString } from '@/utils/note-serialization';
import { isWeakPassword } from '@/utils/password-strength';
import type { Note, NoteVersion } from '@/types/void';

interface BambooScrollProps {
  onLogout?: () => void;
}

export function BambooScroll({ onLogout }: BambooScrollProps) {
  const {
    notes,
    activeNote,
    selectNote,
    createNote,
    saveNote,
    deleteNote,
    unlockSanctum,
    lockVault,
    storageAdapter,
    loadNotes,
    clearActiveNote,
  } = useVoidStore();

  const { theme, toggleTheme } = useThemeStore();
  const [currentUser, setCurrentUser] = useState<string>('');

  const [editingContent, setEditingContent] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newNotePrivate, setNewNotePrivate] = useState(false);
  const [newNotePassword, setNewNotePassword] = useState('');
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const isActiveNoteLocked = activeNote?.isPrivate && !activeNote.notePassword;
  const [isBurning, setIsBurning] = useState(false);
  const burnTimeoutRef = useRef<number | null>(null);
  const searchCacheRef = useRef<Map<string, { updatedAt: number; content: string }>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');
  const [folderFilter, setFolderFilter] = useState<'all' | 'unfiled' | string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Note[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [editingTags, setEditingTags] = useState('');
  const [editingFolder, setEditingFolder] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTrashDialog, setShowTrashDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [trashNotes, setTrashNotes] = useState<Note[]>([]);
  const [noteVersions, setNoteVersions] = useState<NoteVersion[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [currentNotePasswordInput, setCurrentNotePasswordInput] = useState('');
  const [newNotePasswordInput, setNewNotePasswordInput] = useState('');
  const [notePasswordError, setNotePasswordError] = useState('');
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  // Load current user on mount
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    if (!activeNote) {
      setEditingContent('');
      setEditingTitle('');
      setEditingTags('');
      setEditingFolder('');
      setIsEditing(false);
      return;
    }

    setEditingTitle(activeNote.title);
    setEditingTags((activeNote.tags ?? []).join(', '));
    setEditingFolder(activeNote.folder ?? '');

    if (activeNote.isPrivate && !activeNote.notePassword) {
      setEditingContent('');
      setIsEditing(false);
      return;
    }

    // Decrypted private note (password in memory) or public note
    setEditingContent(activeNote.content);
  }, [activeNote]);

  useEffect(() => {
    return () => {
      if (burnTimeoutRef.current) {
        window.clearTimeout(burnTimeoutRef.current);
      }
    };
  }, []);

  const handleQuickCapture = useCallback(async () => {
    const title = `Quick ${new Date().toLocaleString()}`;
    await createNote(title, false);
    setIsEditing(true);
  }, [createNote]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        const title = `Quick ${new Date().toLocaleString()}`;
        void createNote(title, false).then(() => setIsEditing(true));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createNote]);

  useEffect(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    setIsSearching(true);

    const timeout = window.setTimeout(async () => {
      const results: Note[] = [];

      for (const note of notes) {
        const titleMatch = note.title.toLowerCase().includes(term);
        if (titleMatch) {
          results.push(note);
          continue;
        }

        if (note.isPrivate || !storageAdapter?.readNote) {
          continue;
        }

        const cached = searchCacheRef.current.get(note.id);
        let content = '';

        if (cached && cached.updatedAt === note.updatedAt) {
          content = cached.content;
        } else {
          const fullNote = await storageAdapter.readNote(note.id);
          if (fullNote && !fullNote.isPrivate) {
            content = fullNote.content || '';
            searchCacheRef.current.set(note.id, {
              updatedAt: fullNote.updatedAt,
              content,
            });
          }
        }

        if (content.toLowerCase().includes(term)) {
          results.push(note);
        }
      }

      if (!isCancelled) {
        setSearchResults(results);
        setIsSearching(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchQuery, notes, storageAdapter]);

  const availableTags = useMemo(() => {
    const tagMap = new Map<string, string>();
    notes.forEach((note) => {
      (note.tags ?? []).forEach((tag) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!tagMap.has(key)) {
          tagMap.set(key, trimmed);
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  const availableFolders = useMemo(() => {
    const folders = new Set<string>();
    notes.forEach((note) => {
      const folder = (note.folder ?? '').trim();
      if (folder) {
        folders.add(folder);
      }
    });
    return Array.from(folders.values()).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const source = searchResults ?? notes;
    const selectedTagsNormalized = selectedTags.map((tag) => tag.toLowerCase());

    return source.filter((note) => {
      if (privacyFilter === 'public' && note.isPrivate) return false;
      if (privacyFilter === 'private' && !note.isPrivate) return false;

      const folderValue = (note.folder ?? '').trim();
      if (folderFilter === 'unfiled' && folderValue) return false;
      if (folderFilter !== 'all' && folderFilter !== 'unfiled' && folderValue !== folderFilter) {
        return false;
      }

      if (selectedTagsNormalized.length > 0) {
        const noteTags = (note.tags ?? []).map((tag) => tag.toLowerCase());
        const hasAll = selectedTagsNormalized.every((tag) => noteTags.includes(tag));
        if (!hasAll) return false;
      }

      return true;
    });
  }, [notes, searchResults, privacyFilter, folderFilter, selectedTags]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const loadTrash = useCallback(async () => {
    if (!storageAdapter?.listTrash) {
      return;
    }
    const items = await storageAdapter.listTrash();
    setTrashNotes(items);
  }, [storageAdapter]);

  const loadVersions = useCallback(async () => {
    if (!activeNote || !storageAdapter?.listVersions) {
      setNoteVersions([]);
      return;
    }
    const versions = await storageAdapter.listVersions(activeNote.id);
    setNoteVersions(versions);
  }, [activeNote, storageAdapter]);

  const promptUnlock = (noteId: string) => {
    setPendingNoteId(noteId);
    setShowUnlockDialog(true);
    setUnlockError('');
    setUnlockPassword('');
  };

  const handleSelectNote = async (note: Note) => {
    // If private and no in-memory password (still locked), unlock first
    if (activeNote?.id === note.id) {
      if (note.isPrivate && !activeNote.notePassword) {
        promptUnlock(note.id);
      }
      return;
    }

    await selectNote(note.id);
    setIsEditing(false);

    if (note.isPrivate) {
      promptUnlock(note.id);
    }
  };

  const handleUnlockNote = async () => {
    if (!pendingNoteId || !unlockPassword) return;

    try {
      setUnlockError('');
      await unlockSanctum(pendingNoteId, unlockPassword);
      setShowUnlockDialog(false);
      setPendingNoteId(null);
      setUnlockPassword('');
      setIsEditing(false);
    } catch {
      setUnlockError('Wrong password');
    }
  };

  const handleCreateNote = async () => {
    setShowCreateDialog(true);
    setNewNotePrivate(false);
    setNewNotePassword('');
  };

  const formatNoteTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  const handleConfirmCreate = async () => {
    // Validate private note has password
    if (newNotePrivate && !newNotePassword) {
      alert('Private notes require a password');
      return;
    }

    const createdAt = Date.now();
    const title = `Note ${formatNoteTimestamp(createdAt)}`;
    await createNote(
      title,
      newNotePrivate,
      newNotePrivate ? newNotePassword : undefined,
      createdAt
    );
    setShowCreateDialog(false);
    setNewNotePassword('');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (activeNote) {
      const tags = editingTags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      const folder = editingFolder.trim();

      await saveNote({
        ...activeNote,
        title: editingTitle,
        content: editingContent,
        tags,
        folder,
      });
      setIsEditing(false);
    }
  };

  const handleMoveToTrash = async () => {
    if (!activeNote || !storageAdapter?.moveToTrash) {
      return;
    }
    const confirmTrash = confirm('Move this note to trash?');
    if (!confirmTrash) {
      return;
    }
    await storageAdapter.moveToTrash(activeNote.id);
    await loadNotes();
    clearActiveNote();
  };

  const handleBurnDown = () => {
    if (!activeNote || isBurning) {
      return;
    }

    const confirmBurn = confirm('Burn down this note? This will delete it permanently.');
    if (!confirmBurn) {
      return;
    }

    setIsEditing(false);
    setIsBurning(true);

    const noteId = activeNote.id;
    burnTimeoutRef.current = window.setTimeout(async () => {
      try {
        await deleteNote(noteId);
      } finally {
        setIsBurning(false);
        burnTimeoutRef.current = null;
      }
    }, 2800);
  };

  const handleLogout = () => {
    logout();
    lockVault();
    setCurrentUser('');
    if (onLogout) {
      onLogout();
    }
  };

  const handleExportAll = async () => {
    if (!storageAdapter) {
      return;
    }
    setIsExporting(true);
    setExportError('');

    try {
      const exportedNotes: Note[] = [];
      for (const note of notes) {
        const fullNote = await storageAdapter.readNote(note.id);
        if (fullNote) {
          exportedNotes.push(fullNote);
        }
      }

      const backup = {
        app: 'Remind',
        version: 1,
        exportedAt: new Date().toISOString(),
        notes: exportedNotes.map((note) => ({
          id: note.id,
          title: note.title,
          content: note.content,
          isPrivate: note.isPrivate,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          tags: note.tags ?? [],
          folder: note.folder ?? '',
          contentFormat: note.contentFormat ?? 'markdown',
          contentChecksum: note.contentChecksum,
        })),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      downloadBlob(blob, `remind-backup-${Date.now()}.json`);
    } catch (error) {
      console.error('Failed to export backup:', error);
      setExportError('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportNote = async () => {
    if (!activeNote || !storageAdapter) {
      setExportError('No note selected');
      return;
    }
    setIsExporting(true);
    setExportError('');

    try {
      const note = await storageAdapter.readNote(activeNote.id);
      if (!note) {
        setExportError('Unable to read note');
        return;
      }

      const fileBody = serializeNoteFile(note, note.content, {
        format: note.contentFormat ?? 'markdown',
        encrypted: note.isPrivate,
        checksum: note.contentChecksum,
        htmlBackup: note.isPrivate ? undefined : note.contentHtml,
      });
      const blob = new Blob([fileBody], { type: 'text/markdown' });
      const safeTitle = note.title.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'note';
      downloadBlob(blob, `${safeTitle}.md`);
    } catch (error) {
      console.error('Failed to export note:', error);
      setExportError('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    setImportError('');
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
      importFileInputRef.current.click();
    }
  };

  const handleImportNote = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!storageAdapter) {
      setImportError('Storage is not available');
      return;
    }

    setIsImporting(true);
    setImportError('');

    try {
      const text = await file.text();
      const parsed = parseNoteFile(text);
      const frontMatter = parsed.frontMatter;
      let body = parsed.body;
      const encryptedByPayload = isEncryptedPayload(body);
      const isPrivate = typeof frontMatter.isPrivate === 'boolean'
        ? frontMatter.isPrivate || encryptedByPayload
        : encryptedByPayload;

      let contentFormat = frontMatter.format;
      let contentHtml: string | undefined;
      let contentChecksum = frontMatter.checksum;

      if (!isPrivate) {
        const extracted = extractHtmlBackup(body);
        body = extracted.markdown;
        contentHtml = extracted.htmlBackup;
        if (!contentFormat) {
          contentFormat = looksLikeHtml(body) ? 'html' : 'markdown';
        }
        if (!contentChecksum) {
          contentChecksum = hashString(body);
        }
      } else {
        contentFormat = 'markdown';
      }

      const now = Date.now();
      const baseName = file.name.replace(/\.md$/i, '').trim();
      const importedNote: Note = {
        id: `${now}-${Math.random().toString(36).slice(2, 9)}.md`,
        title: (frontMatter.title || baseName || `Imported ${now}`).toString(),
        content: body,
        isPrivate,
        createdAt: frontMatter.createdAt ?? now,
        updatedAt: frontMatter.updatedAt ?? now,
        tags: frontMatter.tags ?? [],
        folder: frontMatter.folder ?? '',
        contentFormat: contentFormat ?? 'markdown',
        contentChecksum,
        contentHtml,
      };

      await storageAdapter.writeNote(importedNote);
      await storageAdapter.saveVersion(importedNote);
      await loadNotes();
      await selectNote(importedNote.id);

      if (importedNote.isPrivate) {
        promptUnlock(importedNote.id);
      }
    } catch (error) {
      console.error('Failed to import note:', error);
      setImportError('Import failed');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const handleOpenTrash = async () => {
    setShowTrashDialog(true);
    await loadTrash();
  };

  const handleRestoreFromTrash = async (noteId: string) => {
    if (!storageAdapter?.restoreFromTrash) {
      return;
    }
    await storageAdapter.restoreFromTrash(noteId);
    await loadNotes();
    await loadTrash();
  };

  const handlePurgeFromTrash = async (noteId: string) => {
    if (!storageAdapter?.purgeFromTrash) {
      return;
    }
    const confirmPurge = confirm('Delete this note permanently?');
    if (!confirmPurge) {
      return;
    }
    await storageAdapter.purgeFromTrash(noteId);
    await loadTrash();
  };

  const handleOpenHistory = async () => {
    if (!activeNote) {
      return;
    }
    setShowHistoryDialog(true);
    await loadVersions();
  };

  const handleRestoreVersion = async (version: NoteVersion) => {
    if (!activeNote) {
      return;
    }
    if (activeNote.isPrivate && !activeNote.notePassword) {
      return;
    }

    let htmlContent = '';

    if (activeNote.isPrivate) {
      if (!activeNote.notePassword) {
        return;
      }
      const decrypted = await decryptNote(version.content, activeNote.notePassword);
      htmlContent = looksLikeHtml(decrypted) ? decrypted : markdownToHtml(decrypted);
    } else {
      htmlContent =
        version.contentFormat === 'html' || looksLikeHtml(version.content)
          ? version.content
          : markdownToHtml(version.content);
    }

    await saveNote({
      ...activeNote,
      title: version.title,
      content: htmlContent,
      tags: version.tags ?? [],
      folder: version.folder ?? '',
    });

    setShowHistoryDialog(false);
  };

  const handleOpenChangePassword = () => {
    if (!activeNote || !activeNote.isPrivate || isActiveNoteLocked) {
      return;
    }
    setCurrentNotePasswordInput('');
    setNewNotePasswordInput('');
    setNotePasswordError('');
    setShowChangePasswordDialog(true);
  };

  const handleChangeNotePassword = async () => {
    if (!activeNote || !activeNote.isPrivate) {
      return;
    }

    if (activeNote.notePassword !== currentNotePasswordInput) {
      setNotePasswordError('Current password is incorrect');
      return;
    }

    if (!newNotePasswordInput) {
      setNotePasswordError('New password is required');
      return;
    }

    const tags = editingTags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const folder = editingFolder.trim();

    await saveNote({
      ...activeNote,
      title: isEditing ? editingTitle : activeNote.title,
      content: isEditing ? editingContent : activeNote.content,
      notePassword: newNotePasswordInput,
      tags,
      folder,
    });

    setShowChangePasswordDialog(false);
  };

  const handleImageUpload = useCallback(async (file: File, mode: 'embed' | 'vault') => {
    if (mode === 'vault' && storageAdapter?.saveAttachment) {
      const assetId = await storageAdapter.saveAttachment(file);
      const blobUrl = URL.createObjectURL(file);
      return { src: blobUrl, assetId };
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
      reader.readAsDataURL(file);
    });
    return { src: dataUrl };
  }, [storageAdapter]);

  return (
    <div className="flex h-screen bg-ink">
      <input
        ref={importFileInputRef}
        type="file"
        accept=".md,text/markdown,text/plain"
        className="hidden"
        onChange={handleImportNote}
      />

      {/* Sidebar - The Catalog */}
      <div className={`w-80 ${theme === 'dark' ? 'bg-ink' : 'bg-panel'} border-r ${theme === 'dark' ? 'border-gold/20' : 'border-gray-200'} flex flex-col`}>
        {/* Header */}
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-gold/20' : 'border-gray-200'}`}>
          <h1 className={`font-serif text-2xl ${theme === 'dark' ? 'text-gold' : 'text-gray-900'} mb-4`}>Remind</h1>
          <ZenButton
            onClick={handleCreateNote}
            variant="pill"
            icon={<Plus className="w-4 h-4" />}
            className="w-full"
          >
            New Note
          </ZenButton>
          <button
            onClick={handleQuickCapture}
            className={`mt-3 w-full px-4 py-2 rounded-full text-xs border transition-all ${
              theme === 'dark'
                ? 'border-gold/30 text-silk/70 hover:text-silk hover:bg-gold/10'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Quick Capture (Ctrl/⌘ + Shift + N)
          </button>
          <div className="mt-3 flex items-center gap-2">
            <ZenButton
              onClick={() => {
                setImportError('');
                setExportError('');
                setShowExportDialog(true);
              }}
              variant="pill"
              icon={<Download className="w-4 h-4" />}
              className="flex-1 px-4 py-2 text-xs"
            >
              Export
            </ZenButton>
            <ZenButton
              onClick={handleOpenTrash}
              variant="pill"
              icon={<Archive className="w-4 h-4" />}
              className="flex-1 px-4 py-2 text-xs"
            >
              Trash
            </ZenButton>
          </div>
        </div>

        {/* Filters */}
        <div className={`px-4 py-4 border-b ${theme === 'dark' ? 'border-gold/20' : 'border-gray-200'}`}>
          <div className="space-y-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-full border ${
              theme === 'dark' ? 'border-gold/30 bg-panel/60' : 'border-gray-300 bg-white'
            }`}>
              <Search className={`w-4 h-4 ${theme === 'dark' ? 'text-gold/60' : 'text-gray-500'}`} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className={`w-full bg-transparent outline-none text-sm ${
                  theme === 'dark' ? 'text-silk placeholder:text-silk/40' : 'text-gray-900 placeholder:text-gray-400'
                }`}
              />
            </div>

            <div className="flex items-center gap-2">
              {(['all', 'public', 'private'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setPrivacyFilter(value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-all ${
                    privacyFilter === value
                      ? theme === 'dark'
                        ? 'border-gold bg-gold/10 text-silk'
                        : 'border-gray-800 bg-gray-900 text-white'
                      : theme === 'dark'
                        ? 'border-gold/20 text-silk/60 hover:text-silk'
                        : 'border-gray-300 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {value === 'all' ? 'All' : value === 'public' ? 'Public' : 'Private'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value as 'all' | 'unfiled' | string)}
                className={`w-full px-3 py-2 rounded-full text-xs border outline-none ${
                  theme === 'dark' ? 'border-gold/30 bg-panel text-silk' : 'border-gray-300 bg-white text-gray-900'
                }`}
              >
                <option value="all">All folders</option>
                <option value="unfiled">Unfiled</option>
                {availableFolders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className={`text-[10px] px-2 py-1 rounded-full border ${
                    theme === 'dark'
                      ? 'border-gold/30 text-silk/60 hover:text-silk'
                      : 'border-gray-300 text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Clear tags
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {availableTags.length === 0 && (
                <span className={`text-[10px] ${theme === 'dark' ? 'text-silk/40' : 'text-gray-400'}`}>
                  No tags yet
                </span>
              )}
              {availableTags.map((tag) => {
                const selected = selectedTags.some((value) => value.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTags((prev) => {
                        if (selected) {
                          return prev.filter((value) => value.toLowerCase() !== tag.toLowerCase());
                        }
                        return [...prev, tag];
                      });
                    }}
                    className={`px-2 py-1 rounded-full text-[10px] border transition-all ${
                      selected
                        ? theme === 'dark'
                          ? 'border-gold bg-gold/10 text-silk'
                          : 'border-gray-800 bg-gray-900 text-white'
                        : theme === 'dark'
                          ? 'border-gold/20 text-silk/60 hover:text-silk'
                          : 'border-gray-300 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>

            {isSearching && (
              <div className={`text-[10px] ${theme === 'dark' ? 'text-silk/40' : 'text-gray-400'}`}>
                Searching content...
              </div>
            )}
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <AnimatePresence>
            {filteredNotes.map((note) => (
              <motion.button
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`w-full px-6 py-3 rounded-full flex items-center justify-between transition-all ${
                  activeNote?.id === note.id
                    ? theme === 'dark'
                      ? 'bg-gold/10 border border-gold'
                      : 'bg-gray-200 border border-gray-400'
                    : theme === 'dark'
                      ? 'bg-panel hover:bg-panel/80 border border-transparent'
                      : 'bg-panel hover:bg-gray-100 border border-gray-200'
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-silk text-sm truncate flex-1 text-left flex items-center gap-2">
                  {note.isPrivate && <Lock className="w-3 h-3 text-cinnabar" />}
                  {note.title}
                </span>
                {note.isPrivate && (
                  <span className="text-cinnabar ml-2">•</span>
                )}
              </motion.button>
            ))}
          </AnimatePresence>

          {filteredNotes.length === 0 && (
            <div className="text-center text-silk/40 py-12">
              <p className="text-sm">{notes.length === 0 ? 'No notes yet' : 'No matches'}</p>
              <p className="text-xs mt-2">
                {notes.length === 0 ? 'Create your first note' : 'Try clearing filters'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Editor - The Canvas */}
      <div className="flex-1 flex flex-col">
        {activeNote ? (
          <>
            {/* Toolbar */}
            <div className={`border-b ${theme === 'dark' ? 'border-gold/20' : 'border-gray-200'} flex items-center justify-between px-8 py-3`}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-4">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className={`bg-transparent border-b ${theme === 'dark' ? 'border-gold/40 text-silk' : 'border-gray-300 text-gray-900'} outline-none text-lg font-serif px-2 py-1`}
                    />
                  ) : (
                    <h2 className={`text-lg font-serif ${theme === 'dark' ? 'text-silk' : 'text-gray-900'}`}>
                      {activeNote.title}
                    </h2>
                  )}
                  {activeNote.isPrivate && (
                    <Lock className="w-4 h-4 text-cinnabar" />
                  )}
                </div>
                <div className={`flex items-center gap-3 text-xs ${theme === 'dark' ? 'text-silk/50' : 'text-gray-500'}`}>
                  {isEditing && !isActiveNoteLocked ? (
                    <>
                      <input
                        type="text"
                        value={editingFolder}
                        onChange={(e) => setEditingFolder(e.target.value)}
                        placeholder="Folder"
                        className={`px-2 py-1 rounded-full border text-xs outline-none ${
                          theme === 'dark'
                            ? 'bg-panel border-gold/30 text-silk placeholder:text-silk/40'
                            : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
                        }`}
                      />
                      <input
                        type="text"
                        value={editingTags}
                        onChange={(e) => setEditingTags(e.target.value)}
                        placeholder="Tags (comma separated)"
                        className={`px-2 py-1 rounded-full border text-xs outline-none w-56 ${
                          theme === 'dark'
                            ? 'bg-panel border-gold/30 text-silk placeholder:text-silk/40'
                            : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
                        }`}
                      />
                    </>
                  ) : (
                    <>
                      <span>
                        Folder: {activeNote.folder?.trim() ? activeNote.folder : 'Unfiled'}
                      </span>
                      <span>
                        Tags: {(activeNote.tags ?? []).length > 0 ? activeNote.tags?.join(', ') : 'None'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isActiveNoteLocked ? (
                  <ZenButton
                    onClick={() => activeNote && promptUnlock(activeNote.id)}
                    variant="pill"
                    icon={<Lock className="w-4 h-4" />}
                    disabled={isBurning}
                  >
                    Unlock
                  </ZenButton>
                ) : isEditing ? (
                  <ZenButton
                    onClick={handleSave}
                    variant="pill"
                    icon={<Save className="w-4 h-4" />}
                    disabled={isBurning}
                  >
                    Save
                  </ZenButton>
                ) : (
                  <ZenButton
                    onClick={() => setIsEditing(true)}
                    variant="pill"
                    icon={<Edit3 className="w-4 h-4" />}
                    disabled={isBurning}
                  >
                    Edit
                  </ZenButton>
                )}
                <ZenButton
                  onClick={handleOpenHistory}
                  variant="pill"
                  icon={<History className="w-4 h-4" />}
                  disabled={isBurning || isActiveNoteLocked}
                >
                  History
                </ZenButton>
                {activeNote.isPrivate && (
                  <ZenButton
                    onClick={handleOpenChangePassword}
                    variant="pill"
                    icon={<Lock className="w-4 h-4" />}
                    disabled={isBurning || isActiveNoteLocked}
                  >
                    Change Password
                  </ZenButton>
                )}
                <ZenButton
                  onClick={handleBurnDown}
                  variant="pill"
                  icon={<Flame className="w-4 h-4" />}
                  disabled={isBurning}
                  className={`${
                    theme === 'dark'
                      ? 'bg-cinnabar/10 border border-cinnabar text-silk hover:bg-cinnabar/20 hover:shadow-lg hover:shadow-cinnabar/20'
                      : 'bg-cinnabar/10 border border-cinnabar text-gray-900 hover:bg-cinnabar/20'
                  }`}
                >
                  Burn_Down
                </ZenButton>
                <button
                  onClick={handleMoveToTrash}
                  disabled={isBurning}
                  className="w-10 h-10 rounded-full flex items-center justify-center border border-cinnabar/40 hover:bg-cinnabar/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Move to Trash"
                >
                  <Trash2 className="w-4 h-4 text-cinnabar" />
                </button>
              </div>
            </div>

            {/* Editor Area */}
            <div className={`flex-1 overflow-hidden burn-surface ${isBurning ? 'burning' : ''}`}>
              <div className="burn-content h-full">
                {isActiveNoteLocked ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Lock className="w-12 h-12 text-cinnabar mx-auto mb-4" />
                      <p className="text-silk/60 text-lg font-serif mb-4">
                        This note is locked
                      </p>
                      <ZenButton
                        onClick={() => activeNote && promptUnlock(activeNote.id)}
                        variant="pill"
                        icon={<Unlock className="w-4 h-4" />}
                      >
                        Unlock to view
                      </ZenButton>
                    </div>
                  </div>
                ) : (
                  <RichTextEditor
                    content={isEditing ? editingContent : activeNote.content}
                    onChange={setEditingContent}
                    editable={isEditing}
                    placeholder="Begin writing your thoughts..."
                    onImageUpload={handleImageUpload}
                  />
                )}
              </div>
              {isBurning && <div className="burn-overlay" />}
            </div>

            {/* Floating Toolbar (Bottom) */}
            <motion.div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-panel/80 backdrop-blur-lg rounded-full border border-gold/40 px-6 py-3 flex items-center gap-4 shadow-lg shadow-gold/10"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <button
                className="flex items-center gap-2 text-sm text-silk/60 hover:text-gold transition-colors"
                onClick={toggleTheme}
                title="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
              <div className="w-px h-4 bg-gold/20" />
              <div className="flex items-center gap-2 text-sm text-silk/60">
                <User className="w-4 h-4" />
                <span>{currentUser}</span>
              </div>
              <div className="w-px h-4 bg-gold/20" />
              <button
                className="flex items-center gap-2 text-sm text-silk/60 hover:text-gold transition-colors"
                onClick={handleLogout}
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
              <div className="w-px h-4 bg-gold/20" />
              <div className="flex items-center gap-2 text-sm text-silk/60">
                <Circle className="w-4 h-4" />
                <span>{activeNote.isPrivate ? 'Private' : 'Public'}</span>
              </div>
              <div className="w-px h-4 bg-gold/20" />
              <span className="text-xs text-silk/40">
                Last edited: {new Date(activeNote.updatedAt).toLocaleString()}
              </span>
            </motion.div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Circle className="w-16 h-16 text-gold/40 mx-auto mb-4" />
              <p className="text-silk/40 text-lg font-serif">
                Select a note or create a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Export Dialog */}
      <AnimatePresence>
        {showExportDialog && (
          <motion.div
            className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${theme === 'dark' ? 'bg-ink/80' : 'bg-gray-900/30'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowExportDialog(false);
              setExportError('');
            }}
          >
            <motion.div
              className={`${theme === 'dark' ? 'bg-panel border-gold/40' : 'bg-panel border-gray-300'} border rounded-3xl p-8 max-w-md w-full mx-4`}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className={`font-serif text-2xl ${theme === 'dark' ? 'text-gold' : 'text-gray-900'} mb-2`}>
                Export
              </h2>
              <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-silk/60' : 'text-gray-600'}`}>
                Download a backup or export the current note.
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleExportAll}
                  disabled={isExporting}
                  className={`w-full px-4 py-3 rounded-2xl border text-sm transition-all ${
                    theme === 'dark'
                      ? 'border-gold/40 text-silk hover:bg-gold/10'
                      : 'border-gray-300 text-gray-800 hover:bg-gray-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Backup All Notes (JSON)
                </button>
                <button
                  onClick={handleExportNote}
                  disabled={!activeNote || isExporting}
                  className={`w-full px-4 py-3 rounded-2xl border text-sm transition-all ${
                    theme === 'dark'
                      ? 'border-gold/40 text-silk hover:bg-gold/10'
                      : 'border-gray-300 text-gray-800 hover:bg-gray-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Export Current Note (.md)
                </button>
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className={`w-full px-4 py-3 rounded-2xl border text-sm transition-all ${
                    theme === 'dark'
                      ? 'border-gold/40 text-silk hover:bg-gold/10'
                      : 'border-gray-300 text-gray-800 hover:bg-gray-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isImporting ? 'Importing...' : 'Import Note (.md)'}
                </button>
              </div>

              {!activeNote && (
                <p className={`text-xs mt-3 ${theme === 'dark' ? 'text-silk/50' : 'text-gray-500'}`}>
                  Select a note in the list before exporting the current note.
                </p>
              )}
              {exportError && (
                <p className="text-cinnabar text-xs mt-3">{exportError}</p>
              )}
              {importError && (
                <p className="text-cinnabar text-xs mt-3">{importError}</p>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowExportDialog(false);
                    setExportError('');
                  }}
                  className={`flex-1 px-6 py-3 rounded-full border transition-all ${
                    theme === 'dark'
                      ? 'border-gold/40 text-silk hover:bg-gold/10'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trash Dialog */}
      <AnimatePresence>
        {showTrashDialog && (
          <motion.div
            className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${theme === 'dark' ? 'bg-ink/80' : 'bg-gray-900/30'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTrashDialog(false)}
          >
            <motion.div
              className={`${theme === 'dark' ? 'bg-panel border-gold/40' : 'bg-panel border-gray-300'} border rounded-3xl p-8 max-w-lg w-full mx-4`}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-serif text-2xl ${theme === 'dark' ? 'text-gold' : 'text-gray-900'}`}>
                  Trash
                </h2>
                <button
                  onClick={() => setShowTrashDialog(false)}
                  className={`text-xs ${theme === 'dark' ? 'text-silk/50' : 'text-gray-500'}`}
                >
                  Close
                </button>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {trashNotes.length === 0 && (
                  <p className={`text-sm ${theme === 'dark' ? 'text-silk/50' : 'text-gray-500'}`}>
                    Trash is empty.
                  </p>
                )}
                {trashNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${
                      theme === 'dark' ? 'border-gold/20' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <p className={`text-sm ${theme === 'dark' ? 'text-silk' : 'text-gray-900'}`}>
                        {note.title}
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-silk/40' : 'text-gray-500'}`}>
                        Deleted: {new Date(note.deletedAt ?? note.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreFromTrash(note.id)}
                        className={`px-3 py-2 text-xs rounded-full border ${
                          theme === 'dark'
                            ? 'border-gold/40 text-silk hover:bg-gold/10'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurgeFromTrash(note.id)}
                        className="px-3 py-2 text-xs rounded-full border border-cinnabar text-cinnabar hover:bg-cinnabar/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Dialog */}
      <AnimatePresence>
        {showHistoryDialog && activeNote && (
          <motion.div
            className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${theme === 'dark' ? 'bg-ink/80' : 'bg-gray-900/30'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHistoryDialog(false)}
          >
            <motion.div
              className={`${theme === 'dark' ? 'bg-panel border-gold/40' : 'bg-panel border-gray-300'} border rounded-3xl p-8 max-w-lg w-full mx-4`}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-serif text-2xl ${theme === 'dark' ? 'text-gold' : 'text-gray-900'}`}>
                  Version History
                </h2>
                <button
                  onClick={() => setShowHistoryDialog(false)}
                  className={`text-xs ${theme === 'dark' ? 'text-silk/50' : 'text-gray-500'}`}
                >
                  Close
                </button>
              </div>

              {isActiveNoteLocked && (
                <p className={`text-sm ${theme === 'dark' ? 'text-silk/50' : 'text-gray-500'}`}>
                  Unlock this note to restore versions.
                </p>
              )}

              {!isActiveNoteLocked && (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {noteVersions.length === 0 && (
                    <p className={`text-sm ${theme === 'dark' ? 'text-silk/50' : 'text-gray-500'}`}>
                      No versions yet.
                    </p>
                  )}
                  {noteVersions.map((version) => (
                    <div
                      key={version.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${
                        theme === 'dark' ? 'border-gold/20' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex-1">
                        <p className={`text-sm ${theme === 'dark' ? 'text-silk' : 'text-gray-900'}`}>
                          {version.title}
                        </p>
                        <p className={`text-xs ${theme === 'dark' ? 'text-silk/40' : 'text-gray-500'}`}>
                          {new Date(version.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreVersion(version)}
                        className={`px-3 py-2 text-xs rounded-full border ${
                          theme === 'dark'
                            ? 'border-gold/40 text-silk hover:bg-gold/10'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Note Password Dialog */}
      <AnimatePresence>
        {showChangePasswordDialog && activeNote && (
          <motion.div
            className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${theme === 'dark' ? 'bg-ink/80' : 'bg-gray-900/30'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowChangePasswordDialog(false)}
          >
            <motion.div
              className={`${theme === 'dark' ? 'bg-panel border-cinnabar/40' : 'bg-panel border-gray-300'} border rounded-3xl p-8 max-w-md w-full mx-4`}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className={`font-serif text-2xl ${theme === 'dark' ? 'text-cinnabar' : 'text-gray-900'} mb-2`}>
                Change Note Password
              </h2>
              <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-silk/60' : 'text-gray-600'}`}>
                Re-encrypt this note with a new password.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={`text-xs ${theme === 'dark' ? 'text-silk/50' : 'text-gray-500'}`}>
                    Current password
                  </label>
                  <input
                    type="password"
                    value={currentNotePasswordInput}
                    onChange={(e) => {
                      setCurrentNotePasswordInput(e.target.value);
                      setNotePasswordError('');
                    }}
                    className={`w-full px-4 py-3 mt-2 rounded-2xl border outline-none transition-all ${
                      theme === 'dark'
                        ? 'bg-ink border-gold/40 text-silk focus:border-gold'
                        : 'bg-panel border-gray-300 text-gray-900 focus:border-gray-500'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-xs ${theme === 'dark' ? 'text-silk/50' : 'text-gray-500'}`}>
                    New password
                  </label>
                  <input
                    type="password"
                    value={newNotePasswordInput}
                    onChange={(e) => {
                      setNewNotePasswordInput(e.target.value);
                      setNotePasswordError('');
                    }}
                    className={`w-full px-4 py-3 mt-2 rounded-2xl border outline-none transition-all ${
                      theme === 'dark'
                        ? 'bg-ink border-gold/40 text-silk focus:border-gold'
                        : 'bg-panel border-gray-300 text-gray-900 focus:border-gray-500'
                    }`}
                  />
                  {newNotePasswordInput.length > 0 && isWeakPassword(newNotePasswordInput) && (
                    <p className="text-xs text-cinnabar mt-2">
                      Weak password. Use 8+ characters with mixed types.
                    </p>
                  )}
                </div>
              </div>

              {notePasswordError && (
                <p className="text-cinnabar text-xs mt-3">{notePasswordError}</p>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowChangePasswordDialog(false)}
                  className={`flex-1 px-6 py-3 rounded-full border transition-all ${
                    theme === 'dark'
                      ? 'border-gold/40 text-silk hover:bg-gold/10'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeNotePassword}
                  className="flex-1 px-6 py-3 rounded-full bg-cinnabar/10 border border-cinnabar text-silk hover:bg-cinnabar/20 transition-all"
                >
                  Update
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Note Dialog */}
      <AnimatePresence>
        {showCreateDialog && (
          <motion.div
            className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${theme === 'dark' ? 'bg-ink/80' : 'bg-gray-900/30'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateDialog(false)}
          >
            <motion.div
              className={`${theme === 'dark' ? 'bg-panel border-gold/40' : 'bg-panel border-gray-300'} border rounded-3xl p-8 max-w-md w-full mx-4`}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className={`font-serif text-2xl ${theme === 'dark' ? 'text-gold' : 'text-gray-900'} mb-6`}>Create New Note</h2>

              <div className="mb-6">
                <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-silk/60' : 'text-gray-600'}`}>
                  Choose whether to encrypt this note:
                </p>

                <div className="flex gap-4">
                  <button
                    onClick={() => setNewNotePrivate(false)}
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all ${
                      !newNotePrivate
                        ? theme === 'dark'
                          ? 'border-gold bg-gold/10'
                          : 'border-gray-400 bg-gray-100'
                        : theme === 'dark'
                          ? 'border-gold/20 hover:border-gold/40'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Unlock className={`w-6 h-6 mx-auto mb-2 ${theme === 'dark' ? 'text-gold' : 'text-gray-700'}`} />
                    <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-silk' : 'text-gray-900'}`}>Public</div>
                    <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-silk/40' : 'text-gray-500'}`}>Not encrypted</div>
                  </button>

                  <button
                    onClick={() => setNewNotePrivate(true)}
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all ${
                      newNotePrivate
                        ? 'border-cinnabar bg-cinnabar/10'
                        : 'border-cinnabar/20 hover:border-cinnabar/40'
                    }`}
                  >
                    <Lock className="w-6 h-6 text-cinnabar mx-auto mb-2" />
                    <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-silk' : 'text-gray-900'}`}>Private</div>
                    <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-silk/40' : 'text-gray-500'}`}>Encrypted</div>
                  </button>
                </div>

                {/* Password input for private notes */}
                {newNotePrivate && (
                  <motion.div
                    className="mt-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label className={`text-sm mb-2 block ${theme === 'dark' ? 'text-silk/60' : 'text-gray-600'}`}>
                      Set password for this note:
                    </label>
                    <input
                      type="password"
                      value={newNotePassword}
                      onChange={(e) => setNewNotePassword(e.target.value)}
                      placeholder="Enter note password"
                      className={`w-full px-4 py-3 rounded-2xl border outline-none transition-all ${
                        theme === 'dark'
                          ? 'bg-ink border-gold/40 text-silk focus:border-gold'
                          : 'bg-panel border-gray-300 text-gray-900 focus:border-gray-500'
                      }`}
                      autoFocus
                    />
                    {newNotePassword.length > 0 && isWeakPassword(newNotePassword) && (
                      <p className="text-xs text-cinnabar mt-2">
                        Weak password. Use 8+ characters with mixed types.
                      </p>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className={`flex-1 px-6 py-3 rounded-full border transition-all ${
                    theme === 'dark'
                      ? 'border-gold/40 text-silk hover:bg-gold/10'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCreate}
                  className={`flex-1 px-6 py-3 rounded-full border transition-all ${
                    theme === 'dark'
                      ? 'bg-gold/10 border-gold text-silk hover:bg-gold/20'
                      : 'bg-gray-900 border-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unlock Note Dialog */}
      <AnimatePresence>
        {showUnlockDialog && (
          <motion.div
            className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${theme === 'dark' ? 'bg-ink/80' : 'bg-gray-900/30'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={`${theme === 'dark' ? 'bg-panel border-cinnabar/40' : 'bg-panel border-red-300'} border rounded-3xl p-8 max-w-md w-full mx-4`}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-6 h-6 text-cinnabar" />
                <h2 className="font-serif text-2xl text-cinnabar">Unlock Note</h2>
              </div>

              <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-silk/60' : 'text-gray-600'}`}>
                This note is encrypted. Enter the note password to unlock it.
              </p>

              <div className="relative mb-6">
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => {
                    setUnlockPassword(e.target.value);
                    setUnlockError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlockNote()}
                  placeholder="Enter password"
                  className={`w-full px-4 py-3 rounded-2xl border outline-none transition-all ${
                    theme === 'dark'
                      ? 'bg-ink border-gold/40 text-silk focus:border-gold'
                      : 'bg-panel border-gray-300 text-gray-900 focus:border-gray-500'
                  }`}
                  autoFocus
                />
                {unlockError && (
                  <motion.div
                    className="flex items-center gap-2 text-cinnabar text-sm mt-2"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <AlertCircle className="w-4 h-4" />
                    {unlockError}
                  </motion.div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowUnlockDialog(false);
                    setPendingNoteId(null);
                    setUnlockPassword('');
                    setUnlockError('');
                  }}
                  className={`flex-1 px-6 py-3 rounded-full border transition-all ${
                    theme === 'dark'
                      ? 'border-gold/40 text-silk hover:bg-gold/10'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlockNote}
                  disabled={!unlockPassword}
                  className="flex-1 px-6 py-3 rounded-full bg-cinnabar/10 border border-cinnabar text-silk hover:bg-cinnabar/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Unlock
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
