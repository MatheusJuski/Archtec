import { useCallback, useEffect } from 'react';
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
  Underline as UnderlineIcon, Highlighter, Link as LinkIcon
} from 'lucide-react'


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
        class: "editor-content focus:outline-none min-h-[150px]",
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

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL do link:', previousUrl);

    if (url === null) return; // cancelou
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null

  return (
    <div className="relative group min-h-75 px-6 py-6 bg-white/2 rounded-xl transition-all duration-300 border border-white/5 focus-within:bg-white/4 focus-within:border-white/10 focus-within:shadow-2xl">
      {/* Bubble Menu (Formatação ao selecionar texto) */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex items-center gap-0.5 bg-[#12122b]/90 backdrop-blur-md border border-white/10 p-1 rounded-lg shadow-2xl"
        >
          {/* Grupo: Texto */}
          <button onClick={() => editor.chain().focus().toggleBold().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('bold') ? 'text-blue-400' : 'text-slate-400'}`}>
            <Bold size={16} />
          </button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('italic') ? 'text-blue-400' : 'text-slate-400'}`}>
            <Italic size={16} />
          </button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('underline') ? 'text-blue-400' : 'text-slate-400'}`}>
            <UnderlineIcon size={16} />
          </button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('strike') ? 'text-blue-400' : 'text-slate-400'}`}>
            <Strikethrough size={16} />
          </button>

          {/* Separador */}
          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Grupo: Semântico */}
          <button onClick={() => editor.chain().focus().toggleCode().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('code') ? 'text-blue-400' : 'text-slate-400'}`}>
            <Code size={16} />
          </button>
          <button onClick={() => editor.chain().focus().toggleHighlight().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('highlight') ? 'text-yellow-400' : 'text-slate-400'}`}>
            <Highlighter size={16} />
          </button>
          <button onClick={setLink} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('link') ? 'text-blue-400' : 'text-slate-400'}`}>
            <LinkIcon size={16} />
          </button>
        </BubbleMenu>
      )}

      {/* Floating Menu (Comandos rápidos em linha vazia) */}
      {editor && (
        <FloatingMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex gap-1 bg-[#12122b]/90 backdrop-blur-md border border-white/10 p-1.5 rounded-lg shadow-2xl ml-11.25"
        >
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            type="button"
            className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('heading', { level: 1 }) ? 'text-blue-400' : 'text-slate-400'}`}
          >
            <Heading1 size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            type="button"
            className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('heading', { level: 2 }) ? 'text-blue-400' : 'text-slate-400'}`}
          >
            <Heading2 size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            type="button"
            className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('bulletList') ? 'text-blue-400' : 'text-slate-400'}`}
          >
            <List size={18} />
          </button>
        </FloatingMenu>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}