import type { Handle, RemixNode } from 'remix/ui'
import { Navbar } from '../navbar.tsx'
import * as s from './style.ts'

interface DashboardLayoutProps {
  children: RemixNode
}

export function DashboardLayout(handle: Handle<DashboardLayoutProps>) {
  return () => (
    <div mix={s.shell}>
      <Navbar />
      <div mix={s.content}>
        {handle.props.children}
      </div>
    </div>
  )
}
