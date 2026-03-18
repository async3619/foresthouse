import { useDashboardData } from '../hooks/useDashboardData'

export function DashboardShell() {
  useDashboardData()

  return <section>Dashboard</section>
}
