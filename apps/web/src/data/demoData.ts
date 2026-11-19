import { createNote, type Note, type NotePatch, type Project } from '@devnotes/core'
import type { DataSnapshot } from './DataStore'

const DAY = 24 * 60 * 60 * 1000

/** Sample content for the demo mode: the same notes as on the design mockups. */
export function createDemoData(today: Date): DataSnapshot {
  const daysAgo = (days: number) => new Date(today.getTime() - days * DAY).toISOString()

  const project = (id: string, name: string, order: number): Project => ({
    id,
    name,
    spreadsheetId: '',
    role: 'owner',
    order,
    addedAt: daysAgo(30),
    removed: false,
  })

  const note = (
    id: string,
    age: number,
    title: string,
    projectId: string | null,
    patch: NotePatch,
  ): Note => ({
    ...createNote({ id: `demo-${id}`, now: daysAgo(age), title, projectId }),
    ...patch,
  })

  return {
    labels: [],
    projects: [
      project('platformer', 'Платформер', 0),
      project('cards', 'Карточная игра', 1),
      project('site', 'Сайт студии', 2),
    ],
    notes: [
      note('floor', 0, 'Персонаж проваливается под пол', 'platformer', {
        body: 'На уровне 2 после двойного прыжка у стены. Повторяется примерно в одном случае из пяти.',
        status: 'wip',
        labels: ['Баг'],
        color: 'red',
        pinned: true,
      }),
      note('hook', 1, 'Крюк-кошка как второй способ передвижения', 'platformer', {
        body: 'Цепляться за потолок и раскачиваться. Проверить, не ломает ли это уровни 1–3.',
        labels: ['Идея'],
        color: 'violet',
        pinned: true,
      }),
      note('leak', 7, 'Утечка памяти при смене сцены', 'platformer', {
        body: 'Причина: подписки на события не снимались. Решение: отписка при уничтожении объекта.',
        status: 'done',
        labels: ['Баг', 'Фикс'],
        solution: 'Отписка от событий при уничтожении объекта.',
      }),
      note('deck', 8, 'Баланс колоды: стартовые карты', 'cards', {
        body: 'Слишком сильное начало. Попробовать убрать одну атаку и добавить защиту.',
        status: 'wip',
        labels: ['Идея'],
      }),
      note('sprites', 9, 'Спросить у художника про размер спрайтов', null, {}),
      note('pause', 10, 'Меню паузы не закрывается с геймпада', 'platformer', {
        body: 'Кнопка «назад» срабатывает только с клавиатуры.',
        labels: ['Баг'],
      }),
      note('form', 12, 'Форма обратной связи на сайте', 'site', {
        body: 'Имя, почта, сообщение. Письма отправлять на общий ящик.',
        status: 'done',
        labels: ['Идея'],
        color: 'green',
      }),
      note('steps', 14, 'Звук шагов по разным поверхностям', 'platformer', {
        body: 'Трава, камень, дерево, вода.',
        labels: ['Идея'],
      }),
      note('undo', 16, 'Карта не сбрасывается после отмены хода', 'cards', {
        body: 'Починил: состояние руки сохраняется до подтверждения хода.',
        status: 'done',
        labels: ['Баг', 'Фикс'],
      }),
      note('prototype', 40, 'Прототип на старом движке', 'platformer', {
        body: 'Решили не продолжать: слишком долгая сборка.',
        status: 'done',
        archived: true,
      }),
    ],
  }
}
