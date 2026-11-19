import { describe, expect, it } from 'vitest'
import { buildAiText, pluralRu } from './aiText'
import { makeNote } from './testing'

describe('text for AI', () => {
  it('puts bugs first, then ideas, with a project line and a summary', () => {
    const text = buildAiText([
      {
        projectName: 'Платформер',
        note: makeNote({
          title: 'Крюк-кошка как второй способ передвижения',
          body: 'Цепляться за потолок и раскачиваться.',
          labels: ['Идея'],
        }),
      },
      {
        projectName: 'Платформер',
        note: makeNote({
          title: 'Персонаж проваливается под пол',
          body: 'Что случилось: проходит сквозь пол.',
          labels: ['Баг'],
        }),
      },
      {
        projectName: 'Платформер',
        note: makeNote({
          title: 'Меню паузы не закрывается с геймпада',
          body: 'Что случилось: кнопка «назад» срабатывает только с клавиатуры.',
          labels: ['Баг'],
        }),
      },
    ])

    expect(text).toBe(
      [
        'Проект: Платформер',
        'Нужно исправить 2 бага и оценить 1 идею.',
        '',
        'БАГ 1. Персонаж проваливается под пол',
        'Что случилось: проходит сквозь пол.',
        '',
        'БАГ 2. Меню паузы не закрывается с геймпада',
        'Что случилось: кнопка «назад» срабатывает только с клавиатуры.',
        '',
        'ИДЕЯ. Крюк-кошка как второй способ передвижения',
        'Цепляться за потолок и раскачиваться.',
      ].join('\n'),
    )
  })

  it('adds the solution and lists other notes last', () => {
    const text = buildAiText([
      { projectName: 'Без проекта', note: makeNote({ title: 'Спросить про спрайты' }) },
      {
        projectName: 'Сайт студии',
        note: makeNote({ title: 'Утечка памяти', labels: ['Баг', 'Фикс'], solution: 'Отписка' }),
      },
    ])
    expect(text).toBe(
      [
        'Проекты: Без проекта, Сайт студии',
        'Нужно исправить 1 баг и разобрать 1 заметку.',
        '',
        'БАГ. Утечка памяти',
        'Как починил: Отписка',
        '',
        'ЗАМЕТКА. Спросить про спрайты',
      ].join('\n'),
    )
  })

  it('names all three kinds in the summary', () => {
    const items = [
      makeNote({ labels: ['Баг'] }),
      makeNote({ labels: ['Идея'] }),
      makeNote({ labels: ['Идея'] }),
      makeNote({ labels: [] }),
    ].map((note) => ({ note, projectName: 'P' }))
    expect(buildAiText(items).split('\n')[1]).toBe(
      'Нужно исправить 1 баг, оценить 2 идеи и разобрать 1 заметку.',
    )
  })

  it('is empty without notes', () => {
    expect(buildAiText([])).toBe('')
  })
})

describe('Russian plural', () => {
  it.each([
    [1, 'баг'],
    [2, 'бага'],
    [5, 'багов'],
    [11, 'багов'],
    [21, 'баг'],
    [104, 'бага'],
  ])('%i → %s', (count, word) => {
    expect(pluralRu(count, 'баг', 'бага', 'багов')).toBe(word)
  })
})
