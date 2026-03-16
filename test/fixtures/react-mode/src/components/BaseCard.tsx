interface BaseCardProps {
  readonly title: string
}

export function BaseCard({ title }: BaseCardProps) {
  return <article>{title}</article>
}
