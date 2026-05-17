import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'

export interface PendingCounts {
  organizers: number   // pending organizer applications
  eventReview: number  // events awaiting approval
  payouts: number      // requested (unpaid) payouts
}

const EMPTY: PendingCounts = { organizers: 0, eventReview: 0, payouts: 0 }
const POLL_INTERVAL = 30_000

export function usePendingCounts(enabled = true) {
  const [counts, setCounts] = useState<PendingCounts>(EMPTY)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const [orgRes, evRes, payRes] = await Promise.allSettled([
        api.get('/admin/organizers', { params: { status: 'pending' } }),
        api.get('/admin/events', { params: { approvalStatus: 'pending', limit: 1 } }),
        api.get('/admin/payouts', { params: { status: 'requested' } }),
      ])

      // GET /admin/organizers → { data: { profiles: [...] } }
      const organizers =
        orgRes.status === 'fulfilled'
          ? (orgRes.value?.data?.data?.profiles?.length ?? 0)
          : 0

      // GET /admin/events → { data: { stats: { pending: N } } }
      const eventReview =
        evRes.status === 'fulfilled'
          ? (evRes.value?.data?.data?.stats?.pending ?? 0)
          : 0

      // GET /admin/payouts → { data: { payouts: [...] } }
      const payouts =
        payRes.status === 'fulfilled'
          ? (payRes.value?.data?.data?.payouts?.length ?? 0)
          : 0

      setCounts({ organizers, eventReview, payouts })
    } catch {
      // badge counts are non-critical — silently ignore
    }
  }, [enabled])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [refresh])

  return counts
}
