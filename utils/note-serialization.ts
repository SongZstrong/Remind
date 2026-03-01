/**
 * Note file serialization helpers for File System storage.
 */

import type { Note } from '@/types/void';

export type NoteContentFormat = 'markdown' | 'html';

export interface NoteFrontMatter {
  title: string;
  createdAt: number;
  updatedAt: number;
  isPrivate: boolean;
  format: NoteContentFormat;
  version: number;
  checksum?: string;
  tags?: string[];
  folder?: string;
  trashed?: boolean;
  deletedAt?: number;
}

const FRONT_MATTER_DELIMITER = '---';
const HTML_BACKUP_START = '<!-- REMIND-HTML';
const HTML_BACKUP_END = 'END-REMIND-HTML -->';

export function serializeNoteFile(
  note: Note,
  body: string,
  options?: {
    format?: NoteContentFormat;
    encrypted?: boolean;
    checksum?: string;
    htmlBackup?: string;
  }
): string {
  const format = options?.format ?? 'markdown';
  const encrypted = options?.encrypted ?? note.isPrivate;
  const checksum =
    options?.checksum ?? (!encrypted ? hashString(body) : note.contentChecksum);

  const frontMatter: NoteFrontMatter = {
    title: note.title || 'Untitled',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    isPrivate: note.isPrivate,
    format,
    version: 1,
    checksum,
    tags: note.tags?.filter((tag) => tag.trim().length > 0) ?? [],
    folder: note.folder?.trim() ?? '',
    trashed: note.trashed ?? false,
    deletedAt: note.deletedAt,
  };

  const frontMatterLines = [
    FRONT_MATTER_DELIMITER,
    `title: ${serializeFrontMatterValue(frontMatter.title)}`,
    `createdAt: ${frontMatter.createdAt}`,
    `updatedAt: ${frontMatter.updatedAt}`,
    `isPrivate: ${frontMatter.isPrivate}`,
    `format: ${frontMatter.format}`,
    `version: ${frontMatter.version}`,
  ];

  if (frontMatter.checksum) {
    frontMatterLines.push(`checksum: ${frontMatter.checksum}`);
  }
  frontMatterLines.push(`folder: ${serializeFrontMatterValue(frontMatter.folder ?? '')}`);
  frontMatterLines.push(`tags: ${serializeFrontMatterValue(frontMatter.tags ?? [])}`);
  frontMatterLines.push(`trashed: ${frontMatter.trashed ? 'true' : 'false'}`);
  if (frontMatter.deletedAt) {
    frontMatterLines.push(`deletedAt: ${frontMatter.deletedAt}`);
  }

  frontMatterLines.push(FRONT_MATTER_DELIMITER);

  let output = `${frontMatterLines.join('\n')}\n${body.trimEnd()}\n`;

  if (!note.isPrivate && options?.htmlBackup) {
    output += `\n${HTML_BACKUP_START}\n${options.htmlBackup}\n${HTML_BACKUP_END}\n`;
  }

  return output;
}

export function parseNoteFile(content: string): {
  frontMatter: Partial<NoteFrontMatter>;
  body: string;
  hasFrontMatter: boolean;
} {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== FRONT_MATTER_DELIMITER) {
    return { frontMatter: {}, body: content, hasFrontMatter: false };
  }

  const frontMatterLines: string[] = [];
  let endIndex = -1;

  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === FRONT_MATTER_DELIMITER) {
      endIndex = i;
      break;
    }
    frontMatterLines.push(lines[i]);
  }

  if (endIndex === -1) {
    return { frontMatter: {}, body: content, hasFrontMatter: false };
  }

  const frontMatter = parseFrontMatter(frontMatterLines);
  const body = lines.slice(endIndex + 1).join('\n');

  return { frontMatter, body, hasFrontMatter: true };
}

export function extractHtmlBackup(body: string): { markdown: string; htmlBackup?: string } {
  const startIndex = body.indexOf(HTML_BACKUP_START);
  if (startIndex === -1) {
    return { markdown: body.trim() };
  }

  const endIndex = body.indexOf(HTML_BACKUP_END, startIndex);
  if (endIndex === -1) {
    return { markdown: body.trim() };
  }

  const htmlBackup = body
    .slice(startIndex + HTML_BACKUP_START.length, endIndex)
    .trim();

  const markdown = `${body.slice(0, startIndex)}${body.slice(
    endIndex + HTML_BACKUP_END.length
  )}`.trim();

  return { markdown, htmlBackup };
}

export function isEncryptedPayload(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) {
    return false;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Boolean(parsed && parsed.iv && parsed.salt && parsed.data);
  } catch {
    return false;
  }
}

export function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function parseFrontMatter(lines: string[]): Partial<NoteFrontMatter> {
  const result: Partial<NoteFrontMatter> = {};

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    const rawValue = match[2].trim();
    const value = parseFrontMatterValue(rawValue);

    if (key === 'title' && typeof value === 'string') {
      result.title = value;
    } else if (key === 'createdAt' && typeof value === 'number') {
      result.createdAt = value;
    } else if (key === 'updatedAt' && typeof value === 'number') {
      result.updatedAt = value;
    } else if (key === 'isPrivate' && typeof value === 'boolean') {
      result.isPrivate = value;
    } else if (key === 'format' && (value === 'markdown' || value === 'html')) {
      result.format = value;
    } else if (key === 'version' && typeof value === 'number') {
      result.version = value;
    } else if (key === 'checksum' && typeof value === 'string') {
      result.checksum = value;
    } else if (key === 'folder' && typeof value === 'string') {
      result.folder = value;
    } else if (key === 'tags') {
      const tags = normalizeTags(value);
      if (tags) {
        result.tags = tags;
      }
    } else if (key === 'trashed' && typeof value === 'boolean') {
      result.trashed = value;
    } else if (key === 'deletedAt' && typeof value === 'number') {
      result.deletedAt = value;
    }
  }

  return result;
}

function parseFrontMatterValue(value: string): string | number | boolean | unknown[] | Record<string, unknown> {
  if (
    (value.startsWith('[') && value.endsWith(']')) ||
    (value.startsWith('{') && value.endsWith('}'))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      // Fall through to string parsing.
    }
  }

  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

  return value;
}

function serializeFrontMatterValue(value: string | number | boolean | string[]): string {
  return JSON.stringify(value);
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }
  return [];
}
