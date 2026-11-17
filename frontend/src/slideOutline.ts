import { acsDocumentId } from './api'
import { lecture as sampleLecture } from './data'
import { lectureName } from './courseStore'
import type { Concept, DocumentInfo, Lecture, LectureTopic } from './types'

export type SlideText = { page: number; text: string }
export const outlinePageLimit = 80

function shorten(text: string, length: number) {
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`
}

function normalizeHeading(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function readSlide(slide: SlideText) {
  const lines = slide.text.split(/\r?\n/).filter(line => /\p{L}/u.test(line))
  if (!lines.length) return
  const clean = (line: string) => line.replace(/^[\s•●▪◦·¡]+/u, '').replace(/\s+/g, ' ').trim()
  const heading = lines.map(clean).find(line => line.length >= 3 && line.length <= 110) ?? `Slide ${slide.page}`
  const next = lines[1]
  const subheading = next && !/^[\s•●▪◦·¡]/u.test(next) && !/[.!?。！？]\s*$/u.test(next)
    && next.length <= 110 && next.length >= 3 ? clean(next) : undefined
  return { page: slide.page, heading, subheading, lines: lines.map(clean) }
}

type OutlinedSlide = NonNullable<ReturnType<typeof readSlide>>

function conceptFromSlides(name: string, section: string, slides: OutlinedSlide[]): Concept {
  const first = slides[0]
  const excerpts = slides.map(slide => slide.lines.filter(line => line !== slide.heading && line !== name))
  const keyPoints = [...new Set(excerpts.map(lines => lines.find(line => line.length >= 20)).filter((line): line is string => !!line))]
  const body = [...new Set([...keyPoints, ...excerpts.flat()])]
  return {
    id: `slide-${first.page}`, name: shorten(name, 76), shortName: shorten(name, 45),
    page: first.page, sourcePages: slides.map(slide => slide.page), eyebrow: section,
    summary: shorten(body.find(line => line.length >= 20) ?? name, 195),
    detail: shorten(body.join(' ') || name, 950),
    keyPoints: body.slice(0, 6).map(line => shorten(line, 155)),
    sourceText: shorten(first.lines.join(' '), 260),
  }
}

function splitSections(slides: OutlinedSlide[]) {
  const runs: OutlinedSlide[][] = []
  for (const slide of slides) {
    const last = runs.at(-1)
    if (last && normalizeHeading(last[0].heading) === normalizeHeading(slide.heading)) last.push(slide)
    else runs.push([slide])
  }
  const sections: { slides: OutlinedSlide[]; hasSectionHeading: boolean }[] = []
  for (const run of runs) {
    const previous = sections.at(-1)
    if (run.length === 1 && previous && !previous.hasSectionHeading && previous.slides.length < 8) {
      previous.slides.push(...run)
    } else {
      sections.push({ slides: run, hasSectionHeading: run.length > 1 })
    }
  }
  return sections
}

function sectionConcepts(slides: OutlinedSlide[], sectionTitle: string, hasSectionHeading: boolean) {
  const titleFor = (slide: OutlinedSlide) => hasSectionHeading ? slide.subheading ?? slide.heading : slide.heading
  const prefixes = new Map<string, number>()
  for (const slide of slides) {
    const title = titleFor(slide)
    const colon = title.search(/[:：]/u)
    if (colon >= 3) {
      const prefix = normalizeHeading(title.slice(0, colon))
      prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1)
    }
  }
  const groups = new Map<string, { title: string; slides: OutlinedSlide[] }>()
  for (const slide of slides) {
    const title = titleFor(slide)
    const colon = title.search(/[:：]/u)
    const prefix = colon >= 3 ? title.slice(0, colon).trim() : title
    const name = (prefixes.get(normalizeHeading(prefix)) ?? 0) >= 2 ? prefix : title
    const key = normalizeHeading(name)
    const group = groups.get(key)
    if (group) group.slides.push(slide)
    else groups.set(key, { title: name, slides: [slide] })
  }
  return [...groups.values()].map(group => conceptFromSlides(group.title, sectionTitle, group.slides))
}

export async function createSlideOutline(doc: DocumentInfo, getPage: (page: number) => Promise<SlideText>): Promise<Lecture> {
  if (doc.document_id === acsDocumentId) return sampleLecture
  const empty = new Set(doc.pages_without_text)
  const available = Array.from({ length: doc.page_count }, (_, i) => i + 1).filter(page => !empty.has(page))
  const pageNumbers = available.length <= outlinePageLimit ? available
    : Array.from({ length: outlinePageLimit }, (_, index) =>
      available[Math.round(index * (available.length - 1) / (outlinePageLimit - 1))])

  const parsedSlides: OutlinedSlide[] = []
  for (let offset = 0; offset < pageNumbers.length; offset += 6) {
    const slides = await Promise.all(pageNumbers.slice(offset, offset + 6).map(getPage))
    for (const slide of slides) {
      const parsed = readSlide(slide)
      if (parsed) parsedSlides.push(parsed)
    }
  }
  if (!parsedSlides.length) throw Error('This lecture has no readable text. Try a PDF or PPTX with selectable text.')

  const concepts: Concept[] = []
  const topics: LectureTopic[] = splitSections(parsedSlides).map(({ slides, hasSectionHeading }) => {
    const sectionTitle = shorten(slides[0].heading, 76)
    const group = sectionConcepts(slides, sectionTitle, hasSectionHeading)
    concepts.push(...group)
    return {
      id: `section-${slides[0].page}`,
      title: sectionTitle,
      firstPage: slides[0].page,
      lastPage: slides[slides.length - 1].page,
      conceptIds: group.map(concept => concept.id),
    }
  })
  const title = lectureName(doc.name)
  return {
    title, fileName: doc.name, totalPages: doc.page_count, concepts, relations: [],
    outline: { title, subtitle: 'From slide text', strategy: 'heading-groups', topics },
  }
}
