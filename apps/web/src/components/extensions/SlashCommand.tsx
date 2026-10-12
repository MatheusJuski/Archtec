import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import {
  Heading1, Heading2, List, ListOrdered, Code,
  Quote, Minus, CheckSquare, Type
} from 'lucide-react'
import { forwardRef } from 'react'
import {
  createSuggestionOptions,
  useSuggestionKeyboard,
  type SuggestionItem,
  type SuggestionListHandle,
  type SuggestionListProps,
} from './suggestion-popup'

interface SlashItem extends SuggestionItem {
  description: string
}

// 1. Definição dos Comandos Disponíveis
const SLASH_ITEMS: SlashItem[] = [
  {
    title: 'Texto',
    description: 'Parágrafo simples',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('paragraph').run()
    },
    icon: <Type size={18} />,
  },
  {
    title: 'Título 1',
    description: 'Título grande',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
    icon: <Heading1 size={18} />,
  },
  {
    title: 'Título 2',
    description: 'Título médio',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
    icon: <Heading2 size={18} />,
  },
  {
    title: 'Lista com Pontos',
    description: 'Lista não ordenada',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
    icon: <List size={18} />,
  },
  {
    title: 'Lista Numerada',
    description: 'Lista ordenada',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
    icon: <ListOrdered size={18} />,
  },
  {
    title: 'Lista de Tarefas',
    description: 'Checkboxes interativos',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
    icon: <CheckSquare size={18} />,
  },
  {
    title: 'Citação',
    description: 'Bloco de citação',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
    icon: <Quote size={18} />,
  },
  {
    title: 'Bloco de Código',
    description: 'Código com syntax',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
    icon: <Code size={18} />,
  },
  {
    title: 'Divisor',
    description: 'Linha horizontal',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
    icon: <Minus size={18} />,
  },
]

const getSuggestionItems = ({ query }: { query: string }) => {
  const q = query.toLowerCase()
  return SLASH_ITEMS.filter(
    (item) => item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
  )
}

// 2. O Componente Visual do Menu (A lista que aparece)
const CommandList = forwardRef<SuggestionListHandle, SuggestionListProps<SlashItem>>((props, ref) => {
  const { selectedIndex, selectItem } = useSuggestionKeyboard(props.items, props.command, ref)

  return (
    <div className="min-w-60 overflow-hidden border border-ink bg-popover p-1 text-popover-foreground shadow-[3px_3px_0_0_var(--ink)]">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={`flex w-full items-center gap-3 px-2.5 py-2 text-left text-sm transition-colors ${
              index === selectedIndex ? 'bg-ink text-surface-1' : 'text-foreground hover:bg-surface-2'
            }`}
            onClick={() => selectItem(index)}
          >
            <span className={`shrink-0 ${index === selectedIndex ? 'text-brand' : 'text-muted-foreground'}`}>
              {item.icon}
            </span>
            <div className="flex flex-col">
              <span className="font-medium">{item.title}</span>
              <span className="text-xs opacity-60">{item.description}</span>
            </div>
          </button>
        ))
      ) : (
        <div className="label-tech px-3 py-3 text-muted-foreground">Sem resultados</div>
      )}
    </div>
  )
})

CommandList.displayName = 'CommandList'

// 3. A Extensão do Tiptap que conecta tudo
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...createSuggestionOptions(
          { pluginKey: new PluginKey('slashSuggestion'), char: '/', items: getSuggestionItems },
          CommandList,
        ),
      }),
    ]
  },
})
