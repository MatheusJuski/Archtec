import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import tippy from 'tippy.js'
import {
  Heading1, Heading2, List, ListOrdered, Code,
  Quote, Minus, CheckSquare, Type
} from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

// 1. Definição dos Comandos Disponíveis
const getSuggestionItems = ({ query }: { query: string }) => {
  return [
    {
      title: 'Texto',
      description: 'Parágrafo simples',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setNode('paragraph').run()
      },
      icon: <Type size={18} />,
    },
    {
      title: 'Título 1',
      description: 'Título grande',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
      },
      icon: <Heading1 size={18} />,
    },
    {
      title: 'Título 2',
      description: 'Título médio',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
      },
      icon: <Heading2 size={18} />,
    },
    {
      title: 'Lista com Pontos',
      description: 'Lista não ordenada',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
      icon: <List size={18} />,
    },
    {
      title: 'Lista Numerada',
      description: 'Lista ordenada',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
      icon: <ListOrdered size={18} />,
    },
    {
      title: 'Lista de Tarefas',
      description: 'Checkboxes interativos',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run()
      },
      icon: <CheckSquare size={18} />,
    },
    {
      title: 'Citação',
      description: 'Bloco de citação',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
      icon: <Quote size={18} />,
    },
    {
      title: 'Bloco de Código',
      description: 'Código com syntax',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
      },
      icon: <Code size={18} />,
    },
    {
      title: 'Divisor',
      description: 'Linha horizontal',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
      icon: <Minus size={18} />,
    },
  ].filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.description.toLowerCase().includes(query.toLowerCase())
  )
}

// 2. O Componente Visual do Menu (A lista que aparece)
const CommandList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command(item)
    }
  }

  useEffect(() => setSelectedIndex(0), [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  return (
    <div className="min-w-60 overflow-hidden border border-ink bg-popover p-1 text-popover-foreground shadow-[3px_3px_0_0_var(--ink)]">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            key={index}
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
              {item.description && (
                <span className="text-xs opacity-60">{item.description}</span>
              )}
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

  addOptions() {
    return {
      suggestion: {
        pluginKey: new PluginKey('slashSuggestion'),
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range })
        },
        render: () => {
          let component: any
          let popup: any

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              })

              if (!props.clientRect) {
                return
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              })
            },
            onUpdate(props: any) {
              component.updateProps(props)
              if (!props.clientRect) return
              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              })
            },
            onKeyDown(props: any) {
              if (props.event.key === 'Escape') {
                popup[0].hide()
                return true
              }
              return component.ref?.onKeyDown(props)
            },
            onExit() {
              popup[0].destroy()
              component.destroy()
            },
          }
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: getSuggestionItems,
      }),
    ]
  },
})