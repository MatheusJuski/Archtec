import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { Heading1, Heading2, List, ListOrdered, Code } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

// 1. Definição dos Comandos Disponíveis
const getSuggestionItems = ({ query }: { query: string }) => {
  return [
    {
      title: 'Título 1',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
      },
      icon: <Heading1 size={18} />,
    },
    {
      title: 'Título 2',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
      },
      icon: <Heading2 size={18} />,
    },
    {
      title: 'Lista com Pontos',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
      icon: <List size={18} />,
    },
    {
      title: 'Lista Numerada',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
      icon: <ListOrdered size={18} />,
    },
    {
      title: 'Bloco de Código',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
      },
      icon: <Code size={18} />,
    },
  ].filter((item) => item.title.toLowerCase().startsWith(query.toLowerCase()))
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
    <div className="bg-slate-900 border border-slate-800 rounded-md shadow-xl overflow-hidden min-w-50 p-1">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            key={index}
            className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded-sm ${
              index === selectedIndex ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
            onClick={() => selectItem(index)}
          >
            {item.icon}
            {item.title}
          </button>
        ))
      ) : (
        <div className="px-2 py-1 text-sm text-slate-500">Sem resultados</div>
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