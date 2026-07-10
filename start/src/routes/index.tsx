import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePlaceholder,
})

function HomePlaceholder() {
  return <main>Selbo Start scaffold</main>
}
