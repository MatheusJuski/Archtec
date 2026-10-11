import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useEditor, EditorContent, FloatingMenu, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Typography from '@tiptap/extension-typography'
import { SlashCommand } from './extensions/SlashCommand'
import { NoteMention } from './extensions/NoteMention'
import {
  Heading1, Heading2, List, Bold, Italic, Strikethrough, Code,
  Underline as UnderlineIcon, Highlighter, Link as LinkIcon, Check, Unlink
} from 'lucide-react'


function MenuButton({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-8 w-8 place-items-center transition-colors",
        active ? "bg-ink text-surface-1" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

const menuClass = "flex items-center gap-0.5 border border-ink bg-popover p-1 shadow-[3px_3px_0_0_var(--ink)]"

interface EditorProps {
  content?: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

export function Editor({ content = "", onChange, editable = true }: EditorProps) {

  const editor = useEditor({
    extensions: [
      StarterKit,
      SlashCommand,
      NoteMention,
      Underline,
      Highlight.configure({ multicolor: false }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      Placeholder.configure({
        placeholder: 'Digite "/" para comandos ou "@" para referenciar nota...',
        includeChildren: true,
        showOnlyWhenEditable: true,
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: "editor-content focus:outline-none min-h-[240px]",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const openLinkEditor = useCallback(() => {
    if (!editor) return;
    setLinkUrl(editor.getAttributes('link').href ?? "");
    setLinkOpen(true);
  }, [editor]);

  const applyLink = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editor) return;
    const url = linkUrl.trim();
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkOpen(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  }, [editor]);

  if (!editor) return null

  return (
    <div className="relative min-h-75">
      {/* Bubble Menu (Formatação ao selecionar texto) */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 120, onHidden: () => setLinkOpen(false) }}
        className={menuClass}
      >
        {linkOpen ? (
          <form onSubmit={applyLink} className="flex items-center gap-1">
            <LinkIcon size={14} className="mx-1.5 text-muted-foreground" />
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setLinkOpen(false) }}
              placeholder="https://"
              className="h-8 w-56 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <MenuButton onClick={() => applyLink()} label="Aplicar link"><Check size={15} /></MenuButton>
            {editor.isActive('link') && (
              <MenuButton onClick={removeLink} label="Remover link"><Unlink size={15} /></MenuButton>
            )}
          </form>
        ) : (
          <>
            <MenuButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Negrito"><Bold size={15} /></MenuButton>
            <MenuButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="Itálico"><Italic size={15} /></MenuButton>
            <MenuButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Sublinhado"><UnderlineIcon size={15} /></MenuButton>
            <MenuButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} label="Tachado"><Strikethrough size={15} /></MenuButton>

            <div className="mx-1 h-5 w-px bg-line" />

            <MenuButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} label="Código"><Code size={15} /></MenuButton>
            <MenuButton active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} label="Destacar"><Highlighter size={15} /></MenuButton>
            <MenuButton active={editor.isActive('link')} onClick={openLinkEditor} label="Link"><LinkIcon size={15} /></MenuButton>
          </>
        )}
      </BubbleMenu>

      {/* Floating Menu (Comandos rápidos em linha vazia) */}
      <FloatingMenu
        editor={editor}
        tippyOptions={{ duration: 120 }}
        className={cn(menuClass, "ml-11.25")}
      >
        <MenuButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="Título 1"><Heading1 size={16} /></MenuButton>
        <MenuButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Título 2"><Heading2 size={16} /></MenuButton>
        <MenuButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Lista"><List size={16} /></MenuButton>
      </FloatingMenu>

      <EditorContent editor={editor} />
    </div>
  )
}
