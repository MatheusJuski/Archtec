import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import tippy from 'tippy.js'
import { FileText, Landmark, ListChecks } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

import { api } from '@/lib/api'

interface NoteOption {
  id: string
  title: string
  content: string
}

interface TaskOption {
  id: string
  title: string
  description: string | null
}

interface TransactionOption {
  id: string
  type: 'INCOME' | 'EXPENSE'
  category: string
  description: string | null
  amount: number
}

type MentionType = 'note' | 'task' | 'transaction'

interface MentionCandidate {
  id: string
  type: MentionType
  title: string
  preview: string
  href: string
}

const NOTE_CACHE_TTL_MS = 15000
let noteCache: NoteOption[] = []
let noteCacheLoadedAt = 0
let taskCache: TaskOption[] = []
let taskCacheLoadedAt = 0
let transactionCache: TransactionOption[] = []
let transactionCacheLoadedAt = 0

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

async function loadTasks() {
  const now = Date.now()
  if (now - taskCacheLoadedAt < NOTE_CACHE_TTL_MS && taskCache.length > 0) {
    return taskCache
  }

  const response = await api.get<TaskOption[]>('/tasks')
  taskCache = response.data.map((task) => ({
    id: task.id,
    title: task.title || 'Tarefa sem titulo',
    description: task.description || null,
  }))
  taskCacheLoadedAt = now
  return taskCache
}

async function loadTransactions() {
  const now = Date.now()
  if (now - transactionCacheLoadedAt < NOTE_CACHE_TTL_MS && transactionCache.length > 0) {
    return transactionCache
  }

  const response = await api.get<TransactionOption[]>('/transactions')
  transactionCache = response.data
  transactionCacheLoadedAt = now
  return transactionCache
}

function toMentionLabel(item: MentionCandidate) {
  if (item.type === 'task') return `@Tarefa: ${item.title}`
  if (item.type === 'transaction') return `@Financeiro: ${item.title}`
  return `@Nota: ${item.title}`
}

async function getMentionItems({ query }: { query: string }) {
  const [notes, tasks, transactions] = await Promise.all([
    loadNotes(),
    loadTasks(),
    loadTransactions(),
  ])

  const normalized = query.trim().toLowerCase()

  const transactionFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  const allItems: MentionCandidate[] = [
    ...notes.map((note) => ({
      id: note.id,
      type: 'note' as const,
      title: note.title,
      preview: note.content.replace(/<[^>]+>/g, ' ').trim().slice(0, 80),
      href: `/notes/${note.id}`,
    })),
    ...tasks.map((task) => ({
      id: task.id,
      type: 'task' as const,
      title: task.title,
      preview: task.description?.trim().slice(0, 80) || 'Sem descrição',
      href: `/tasks?taskId=${task.id}`,
    })),
    ...transactions.map((transaction) => {
      const sign = transaction.type === 'INCOME' ? '+' : '-'
      const title = `${transaction.category} (${sign}${transactionFormatter.format(transaction.amount)})`
      return {
        id: transaction.id,
        type: 'transaction' as const,
        title,
        preview: transaction.description?.trim().slice(0, 80) || 'Lançamento financeiro',
        href: `/finance?transactionId=${transaction.id}`,
      }
    }),
  ]

  return allItems
    .filter((item) => {
      if (!normalized) return true
      const textContent = item.preview.toLowerCase()
      return (
        item.title.toLowerCase().includes(normalized) ||
        textContent.includes(normalized)
      )
    })
    .slice(0, 8)
    .map((item) => ({
      ...item,
      icon:
        item.type === 'note' ? <FileText size={16} /> :
        item.type === 'task' ? <ListChecks size={16} /> :
        <Landmark size={16} />,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: 'text',
              text: toMentionLabel(item),
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: item.href,
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
              <span className="block truncate font-medium">{toMentionLabel(item)}</span>
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
        pluginKey: new PluginKey('noteMentionSuggestion'),
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
