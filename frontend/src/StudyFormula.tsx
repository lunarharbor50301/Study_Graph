import katex from 'katex'
import 'katex/dist/katex.min.css'

const delimitedMath = /^(?:\\\(([\s\S]+)\\\)|\\\[([\s\S]+)\\\]|\$\$([\s\S]+)\$\$|\$([^$]+)\$)$/

export default function StudyFormula({ source }: { source: string }) {
  const delimited = source.match(delimitedMath)
  const math = delimited?.slice(1).find(Boolean) ??
    (/\\[a-z]+|[a-z0-9][_^](?:\{|[a-z0-9])/i.test(source) ? source : undefined)
  let markup: string | undefined
  if (math) {
    try {
      markup = katex.renderToString(String.raw`\displaystyle ${math}`, {
        trust: false,
        maxSize: 20,
        strict: 'ignore',
      })
    } catch (error) {
      if (!(error instanceof katex.ParseError)) throw error
    }
  }

  return <section className="formula-card">
    <span>Key relationship</span>
    {markup
      ? <div className="formula-card__math" dangerouslySetInnerHTML={{ __html: markup }}/>
      : <strong>{source}</strong>}
  </section>
}
