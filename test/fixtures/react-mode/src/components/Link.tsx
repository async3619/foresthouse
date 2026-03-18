interface LinkProps {
  readonly href: string
  readonly label: string
}

export function Link({ href, label }: LinkProps) {
  return <a href={href}>{label}</a>
}
