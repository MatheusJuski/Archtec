import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { FileText, Landmark, ListChecks } from 'lucide-react'
import { forwardRef } from 'react'
import {
  createSuggestionOptions,
  useSuggestionKeyboard,
  type SuggestionItem,
  type SuggestionListHandle,
  type SuggestionListProps,
} from './suggestion-popup'

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

type MentionItem = MentionCandidate & SuggestionItem

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
    title: note.title || 'Sem título',
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
    title: task.title || 'Tarefa sem título',
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
    .map((item): MentionItem => ({
      ...item,
      icon:
        item.type === 'note' ? <FileText size={16} /> :
        item.type === 'task' ? <ListChecks size={16} /> :
        <Landmark size={16} />,
      command: ({ editor, range }) => {
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

const MentionList = forwardRef<SuggestionListHandle, SuggestionListProps<MentionItem>>((props, ref) => {
  const { selectedIndex, selectItem } = useSuggestionKeyboard(props.items, props.command, ref)

  return (
    <div className="min-w-64 overflow-hidden border border-ink bg-popover p-1 text-popover-foreground shadow-[3px_3px_0_0_var(--ink)]">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={`${item.type}:${item.id}`}
            className={`flex w-full items-start gap-3 px-2.5 py-2 text-left text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-ink text-surface-1'
                : 'text-foreground hover:bg-surface-2'
            }`}
            onClick={() => selectItem(index)}
            type="button"
          >
            <span className={index === selectedIndex ? 'text-brand' : 'text-muted-foreground'}>
              {item.icon}
            </span>
            <div className="min-w-0">
              <span className="block truncate font-medium">{toMentionLabel(item)}</span>
              <span className="block truncate text-xs opacity-60">
                {item.preview || 'Sem conteúdo'}
              </span>
            </div>
          </button>
        ))
      ) : (
        <div className="label-tech px-3 py-3 text-muted-foreground">Nada encontrado</div>
      )}
    </div>
  )
})

MentionList.displayName = 'MentionList'

export const NoteMention = Extension.create({
  name: 'noteMention',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...createSuggestionOptions(
          { pluginKey: new PluginKey('noteMentionSuggestion'), char: '@', items: getMentionItems },
          MentionList,
        ),
      }),
    ]
  },
})
