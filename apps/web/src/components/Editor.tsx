import { useEditor, EditorContent, FloatingMenu, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import FloatingMenuExtension from '@tiptap/extension-floating-menu'
import Placeholder from '@tiptap/extension-placeholder'
import { SlashCommand } from './extensions/SlashCommand'
import {
  Heading1, Heading2, List, Bold, Italic, Strikethrough, Code
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
      FloatingMenuExtension,
      SlashCommand,
      Placeholder.configure({
        placeholder: 'Digite "/" para comandos...',
        includeChildren: true,
        showOnlyWhenEditable: true,
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        // CORREÇÃO DE FONTE E COR:
        // font-sans (Inter) no corpo, [&_h1,h2]:font-heading (Oswald) nos títulos
        class: "font-sans prose prose-invert prose-base sm:prose-lg max-w-none focus:outline-none min-h-[150px] [&_h1]:font-heading [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:mb-6 [&_h1]:mt-8 [&_h2]:font-heading [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:mb-4 [&_h2]:mt-6 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:bg-slate-800/50 [&_code]:text-blue-300 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-slate-900/50 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-white/5 [&_.is-empty::before]:content-[attr(data-placeholder)] [&_.is-empty::before]:text-slate-500 [&_.is-empty::before]:float-left [&_.is-empty::before]:pointer-events-none [&_.is-empty::before]:h-0 [&_li>.is-empty::before]:hidden",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  })

  if (!editor) return null

  return (
    // Cores ajustadas para o novo tema do Architec
    <div className="border border-white/5 rounded-xl bg-[#0a0a1a] p-6 relative group min-h-[200px] shadow-2xl">

      {/* Bubble Menu (Formatação) */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex gap-1 bg-[#12122b] border border-white/10 p-1.5 rounded-lg shadow-2xl backdrop-blur-md"
        >
          <button onClick={() => editor.chain().focus().toggleBold().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('bold') ? 'text-blue-400' : 'text-slate-400'}`}>
            <Bold size={16} />
          </button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('italic') ? 'text-blue-400' : 'text-slate-400'}`}>
            <Italic size={16} />
          </button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('strike') ? 'text-blue-400' : 'text-slate-400'}`}>
            <Strikethrough size={16} />
          </button>
          <button onClick={() => editor.chain().focus().toggleCode().run()} type="button" className={`p-1.5 rounded-md transition-colors hover:bg-white/5 ${editor.isActive('code') ? 'text-blue-400' : 'text-slate-400'}`}>
            <Code size={16} />
          </button>
        </BubbleMenu>
      )}

      {/* Floating Menu (Comandos rápidos) */}
      {editor && (
        <FloatingMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex gap-1 bg-[#12122b] border border-white/10 p-1.5 rounded-lg shadow-2xl ml-[-45px]"
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