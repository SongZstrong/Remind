/**
 * RichTextEditor
 * Supports Markdown, image insertion, and rich text formatting
 */

'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import {
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo
} from 'lucide-react';
import { useThemeStore } from '@/store/theme-store';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  onImageUpload?: (file: File, mode: 'embed' | 'vault') => Promise<{
    src: string;
    assetId?: string;
  } | null>;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  editable = true,
  onImageUpload,
}: RichTextEditorProps) {
  const { theme } = useThemeStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        inline: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-gold hover:underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Typography,
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose ${theme === 'dark' ? 'prose-invert' : 'prose-slate'} max-w-none focus:outline-none p-4`,
      },
    },
  });

  // Update content when it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  const addImage = () => {
    const url = window.prompt('Enter image URL (leave blank to upload):');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {editable && (
        <div className={`flex flex-wrap items-center gap-1 p-2 border-b ${
          theme === 'dark' ? 'border-gold/20 bg-panel' : 'border-gray-200 bg-panel'
        }`}>
          {/* Text Formatting */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-gold/10 ${
              editor.isActive('bold') ? 'bg-gold/20' : ''
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-gold/10 ${
              editor.isActive('italic') ? 'bg-gold/20' : ''
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded hover:bg-gold/10 ${
              editor.isActive('code') ? 'bg-gold/20' : ''
            }`}
            title="Code"
          >
            <Code className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gold/20 mx-1" />

          {/* Headings */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-2 rounded hover:bg-gold/10 ${
              editor.isActive('heading', { level: 1 }) ? 'bg-gold/20' : ''
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 rounded hover:bg-gold/10 ${
              editor.isActive('heading', { level: 2 }) ? 'bg-gold/20' : ''
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gold/20 mx-1" />

          {/* Lists */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-gold/10 ${
              editor.isActive('bulletList') ? 'bg-gold/20' : ''
            }`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-gold/10 ${
              editor.isActive('orderedList') ? 'bg-gold/20' : ''
            }`}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-2 rounded hover:bg-gold/10 ${
              editor.isActive('blockquote') ? 'bg-gold/20' : ''
            }`}
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gold/20 mx-1" />

          {/* Media */}
          <button
            onClick={addImage}
            className="p-2 rounded hover:bg-gold/10"
            title="Insert Image"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <button
            onClick={addLink}
            className="p-2 rounded hover:bg-gold/10"
            title="Insert Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gold/20 mx-1" />

          {/* Undo/Redo */}
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-2 rounded hover:bg-gold/10 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-2 rounded hover:bg-gold/10 disabled:opacity-30"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor Content */}
      <div className={`flex-1 overflow-y-auto ${
        theme === 'dark' ? 'bg-ink' : 'bg-panel'
      }`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            if (!event.target.files || event.target.files.length === 0 || !editor) {
              return;
            }

            const file = event.target.files[0];
            const mode = window.confirm('Store image in vault assets? OK = Vault, Cancel = Embed')
              ? 'vault'
              : 'embed';

            let result: { src: string; assetId?: string } | null = null;

            if (onImageUpload) {
              result = await onImageUpload(file, mode);
            } else {
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
                reader.readAsDataURL(file);
              });
              result = { src: dataUrl };
            }

            if (!result) {
              return;
            }

            if (result.assetId) {
              editor.commands.insertContent(
                `<img src="${result.src}" data-asset="${result.assetId}" alt="" />`
              );
            } else {
              editor.chain().focus().setImage({ src: result.src }).run();
            }
          }}
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
