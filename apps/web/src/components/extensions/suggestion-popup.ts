import type { Editor, Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import tippy, { type GetReferenceClientRect, type Instance as TippyInstance } from 'tippy.js'
import { useImperativeHandle, useState, type ComponentType, type ReactNode, type Ref } from 'react'

/** Item de menu de sugestão ("/" e "@"): sabe se aplicar no editor. */
export interface SuggestionItem {
  title: string
  icon: ReactNode
  command: (ctx: { editor: Editor; range: Range }) => void
}

/** Props que o Tiptap entrega para a lista renderizada no popup. */
export type SuggestionListProps<T extends SuggestionItem> = SuggestionProps<T, T>

/** API imperativa da lista: o Tiptap repassa as teclas para ela. */
export interface SuggestionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

/**
 * Navegação por teclado (↑ ↓ Enter) compartilhada pelas listas de sugestão.
 * O índice volta para 0 quando a lista muda, ajustando o estado durante o render
 * (padrão recomendado pelo React em vez de setState dentro de useEffect).
 */
export function useSuggestionKeyboard<T extends SuggestionItem>(
  items: T[],
  onSelect: (item: T) => void,
  ref: Ref<SuggestionListHandle>,
) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [prevItems, setPrevItems] = useState(items)
  if (items !== prevItems) {
    setPrevItems(items)
    setSelectedIndex(0)
  }

  const selectItem = (index: number) => {
    const item = items[index]
    if (item) onSelect(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      const count = items.length
      if (count === 0) return false
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + count - 1) % count)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % count)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  return { selectedIndex, selectItem }
}

type ListComponent<T extends SuggestionItem> = ComponentType<
  SuggestionListProps<T> & { ref?: Ref<SuggestionListHandle> }
>

/** Opções de sugestão que mostram a lista num popup tippy ancorado no cursor. */
export function createSuggestionOptions<T extends SuggestionItem>(
  base: Pick<SuggestionOptions<T, T>, 'pluginKey' | 'char' | 'items'>,
  List: ListComponent<T>,
): Omit<SuggestionOptions<T, T>, 'editor'> {
  return {
    ...base,
    command: ({ editor, range, props }) => {
      props.command({ editor, range })
    },
    render: () => {
      let component: ReactRenderer<SuggestionListHandle, SuggestionListProps<T>> | null = null
      let popup: TippyInstance | null = null

      return {
        onStart: (props) => {
          component = new ReactRenderer(List, { props, editor: props.editor })
          if (!props.clientRect) return

          popup = tippy(document.body, {
            getReferenceClientRect: props.clientRect as GetReferenceClientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        },
        onUpdate: (props) => {
          component?.updateProps(props)
          if (!props.clientRect) return
          popup?.setProps({ getReferenceClientRect: props.clientRect as GetReferenceClientRect })
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            popup?.hide()
            return true
          }
          return component?.ref?.onKeyDown(props) ?? false
        },
        onExit: () => {
          popup?.destroy()
          component?.destroy()
          popup = null
          component = null
        },
      }
    },
  }
}
