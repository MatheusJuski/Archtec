import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { FileText } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

import { api } from '@/lib/api'

interface NoteOption {
  id: string
  title: string
  content: string
}

const NOTE_CACHE_TTL_MS = 15000
let noteCache: NoteOption[] = []
let noteCacheLoadedAt = 0

async function loadNotes() {
  const now = Date.now()
  if (now - noteCacheLoadedAt < NOTE_CACHE_TTL_MS && noteCache.length > 0) {
    return noteCache
  }

  const response = await api.get<NoteOption[]>('/notes')
  noteCache = response.data.map((note) => ({
    id: note.id,
    title: note.title || 'Sem titulo',
    content: note.content || '',
  }))
  noteCacheLoadedAt = now
  return noteCache
}

async function getMentionItems({ query }: { query: string }) {
  const notes = await loadNotes()
  const normalized = query.trim().toLowerCase()

  return notes
    .filter((note) => {
      if (!normalized) return true
      const textContent = note.content.replace(/<[^>]+>/g, ' ').toLowerCase()
      return (
        note.title.toLowerCase().includes(normalized) ||
        textContent.includes(normalized)
      )
    })
    .slice(0, 8)
    .map((note) => ({
      ...note,
      preview: note.content.replace(/<[^>]+>/g, ' ').trim().slice(0, 80),
      icon: <FileText size={16} />,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: 'text',
              text: `@${note.title}`,
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: `/notes/${note.id}`,
                  },
                },
              ],
            },
            {
              type: 'text',
              text: ' ',
            },
          ])
          .run()
      },
    }))
}

const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command(item)
    }
  }

  useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      const itemCount = props.items.length
      if (itemCount === 0) return false

      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + itemCount - 1) % itemCount)
        return true
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % itemCount)
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
    <div className="min-w-64 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 p-1 shadow-2xl">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            key={item.id}
            className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-slate-300 hover:bg-white/5'
            }`}
            onClick={() => selectItem(index)}
            type="button"
          >
            <span className={index === selectedIndex ? 'text-blue-400' : 'text-slate-500'}>
              {item.icon}
            </span>
            <div className="min-w-0">
              <span className="block truncate font-medium">{item.title}</span>
              <span className="block truncate text-xs text-slate-500">
                {item.preview || 'Sem conteudo'}
              </span>
            </div>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-slate-500">Nenhuma nota encontrada</div>
      )}
    </div>
  )
})

MentionList.displayName = 'MentionList'

export const NoteMention = Extension.create({
  name: 'noteMention',

  addOptions() {
    return {
      suggestion: {
        char: '@',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range })
        },
        render: () => {
          let component: any
          let popup: any

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(MentionList, {
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
        items: getMentionItems,
      }),
    ]
  },
})
