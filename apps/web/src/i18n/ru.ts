/**
 * All interface strings live in this module so that another language can be
 * added later by providing a second object of the same shape.
 */
export const ru = {
  appName: 'DevNotes',
  shell: {
    sidebarLabel: 'Разделы',
    allNotes: 'Все заметки',
    emptyTitle: 'Здесь пока пусто',
    emptyHint: 'Каркас приложения готов. Заметки появятся на следующем этапе.',
  },
} as const

export type Strings = typeof ru
