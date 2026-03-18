import { memo } from 'react'
import styled from 'styled-components'

import { BaseCard } from './components/BaseCard'
import { Link } from './components/Link'

const Button = styled.button`
  color: red;
`

const Card = styled(BaseCard)`
  padding: 12px;
`

const LinkButton = styled(Link)({
  display: 'inline-flex',
})

const Section = styled.div({
  gap: '1rem',
})

const MemoLink = memo(function MemoLink() {
  return <Link href="/memo" label="Memo" />
})

export function StyledEntry() {
  return (
    <Section>
      <Button>Save</Button>
      <Card title="Forest House" />
      <LinkButton href="/docs" label="Docs" />
      <MemoLink />
    </Section>
  )
}
