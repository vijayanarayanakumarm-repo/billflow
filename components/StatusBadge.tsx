import { InvoiceStatus } from '@/types'

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const classes: Record<InvoiceStatus, string> = {
    draft: 'badge-draft',
    sent: 'badge-sent',
    paid: 'badge-paid',
    overdue: 'badge-overdue',
    cancelled: 'badge-cancelled',
  }
  return (
    <span className={classes[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
