import { describe, expect, it } from 'vitest'
import {
  AI_IMPORT_MAX_NEW_LABELS,
  AI_IMPORT_MAX_NOTES,
  AI_INSTRUCTION,
  extractJson,
  parseAiImport,
  type AiImport,
  type AiImportResult,
} from './aiImport'
import { allLabels } from './labels'

const labels = allLabels([{ name: 'Звук', color: 'teal', createdAt: '2026-11-01T00:00:00.000Z' }])

function ok(result: AiImportResult): AiImport {
  if ('error' in result) throw new Error(`Expected cards, got ${result.error}`)
  return result
}

const answer = (notes: unknown[]) => JSON.stringify({ devnotes: 1, notes })

describe('finding the JSON', () => {
  it('takes the first json code block', () => {
    const text = 'Нашёл две проблемы:\n```json\n{"notes":[]}\n```\nи ещё ```json\n{"x":1}\n```'
    expect(extractJson(text)).toBe('{"notes":[]}')
  })

  it('takes the first JSON object when there is no code block', () => {
    const text = 'Вот карточки: {"notes":[{"title":"a } b"}]} — готово. {"other":1}'
    expect(extractJson(text)).toBe('{"notes":[{"title":"a } b"}]}')
  })

  it('finds nothing in plain text', () => {
    expect(extractJson('Никаких карточек')).toBeNull()
  })
})

describe('reading an AI answer', () => {
  it('reads the format from the instruction', () => {
    const result = ok(
      parseAiImport(
        '```json\n' +
          answer([
            {
              title: 'Меню паузы не закрывается с геймпада',
              body: 'Что случилось: ...\nКак повторить: ...',
              labels: ['Баг'],
              status: 'wip',
              solution: '',
            },
          ]) +
          '\n```',
        labels,
      ),
    )
    expect(result.notes).toEqual([
      {
        title: 'Меню паузы не закрывается с геймпада',
        body: 'Что случилось: ...\nКак повторить: ...',
        labels: ['Баг'],
        status: 'wip',
        solution: '',
      },
    ])
    expect(result).toMatchObject({ newLabels: [], droppedLabels: [], skipped: 0, overLimit: 0 })
  })

  it('needs only a title and fixes the rest', () => {
    const result = ok(
      parseAiImport(
        answer([
          { title: '  Только заголовок  ' },
          { title: 'Странный статус', status: 'later', body: 42, labels: 'Баг' },
          { body: 'Без заголовка' },
          'не карточка',
        ]),
        labels,
      ),
    )
    expect(result.notes).toEqual([
      { title: 'Только заголовок', body: '', labels: [], status: 'new', solution: '' },
      { title: 'Странный статус', body: '', labels: [], status: 'new', solution: '' },
    ])
    expect(result.skipped).toBe(2)
  })

  it('matches existing labels without regard to case and by English names', () => {
    const result = ok(
      parseAiImport(answer([{ title: 'a', labels: ['баг', 'bug', 'ЗВУК', 'Idea'] }]), labels),
    )
    expect(result.notes[0]?.labels).toEqual(['Баг', 'Звук', 'Идея'])
    expect(result.newLabels).toEqual([])
  })

  it('creates at most ten new labels and drops the rest', () => {
    const names = Array.from(
      { length: AI_IMPORT_MAX_NEW_LABELS + 2 },
      (_, i) => `Метка ${String(i + 1)}`,
    )
    const result = ok(
      parseAiImport(
        answer([
          { title: 'a', labels: names },
          { title: 'b', labels: ['метка 1', 'Метка 12'] },
        ]),
        labels,
      ),
    )
    expect(result.newLabels).toHaveLength(AI_IMPORT_MAX_NEW_LABELS)
    expect(result.droppedLabels).toEqual(['Метка 11', 'Метка 12'])
    expect(result.notes[1]?.labels).toEqual(['Метка 1'])
  })

  it('keeps at most a hundred cards and cuts long text', () => {
    const many = Array.from({ length: AI_IMPORT_MAX_NOTES + 5 }, (_, i) => ({
      title: `Карточка ${String(i)}`,
    }))
    many[0] = { title: 'Я'.repeat(300), body: 'Т'.repeat(25_000) } as never
    const result = ok(parseAiImport(answer(many), labels))
    expect(result.notes).toHaveLength(AI_IMPORT_MAX_NOTES)
    expect(result.overLimit).toBe(5)
    expect(result.notes[0]?.title).toHaveLength(200)
    expect(result.notes[0]?.body).toHaveLength(20_000)
  })

  it('explains what is wrong', () => {
    expect(parseAiImport('Ответ без JSON', labels)).toEqual({ error: 'noJson' })
    expect(parseAiImport('```json\n{"notes": [\n```', labels)).toEqual({ error: 'invalidJson' })
    expect(parseAiImport('{"cards": []}', labels)).toEqual({ error: 'noNotes' })
    expect(parseAiImport(answer([{ body: 'без заголовка' }]), labels)).toEqual({ error: 'noNotes' })
  })

  it('reads the example from its own instruction', () => {
    const result = ok(parseAiImport(AI_INSTRUCTION, labels))
    expect(result.notes[0]).toMatchObject({
      title: 'Меню паузы не закрывается с геймпада',
      labels: ['Баг'],
    })
  })
})
