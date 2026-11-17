import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function normalizeLists(text: string) {
  let fence: string | undefined
  return text.split('\n').map(line => {
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line)?.[1]
      if (closing?.[0] === fence[0] && closing.length >= fence.length) fence = undefined
      return line
    }
    fence = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    if (fence) return line
    // CommonMark needs a space after the list marker, as in `1. **Heading**`.
    return line.replace(/^( {0,3}\d{1,9}[.)])(?=\*\*\S)/, '$1 ')
  }).join('\n')
}

export default function TutorMarkdown({ text }: { text: string }) {
  return <div className="tutor-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img']}>
    {normalizeLists(text)}
  </Markdown></div>
}
