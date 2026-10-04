import { useEffect, useState } from 'react'
import { mobileDownloadApi, type MobileRelease } from './mobileDownloadApi'

const refreshIntervalMs = 60_000

export function usePublicMobileRelease(restaurantId?: string) {
  const [release, setRelease] = useState<MobileRelease | null>(null)

  useEffect(() => {
    let active = true
    let version = 0

    const refresh = async () => {
      const current = ++version
      setRelease(null)
      try {
        const next = restaurantId
          ? await mobileDownloadApi.restaurantRelease(restaurantId)
          : await mobileDownloadApi.publicRelease()
        if (active && current === version) setRelease(next?.isVisible === true ? next : null)
      } catch {
        if (active && current === version) setRelease(null)
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), refreshIntervalMs)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [restaurantId])

  return release
}
