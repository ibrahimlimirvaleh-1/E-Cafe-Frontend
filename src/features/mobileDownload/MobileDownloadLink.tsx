import { Download } from 'lucide-react'
import type { MobileRelease } from './mobileDownloadApi'
import './mobileDownload.css'

type MobileDownloadLinkProps = {
  release: MobileRelease | null
}

export function safeApkDownloadUrl(value: string | null | undefined): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
    return url.toString()
  } catch {
    return null
  }
}

export function readyMobileDownloadUrl(release: MobileRelease | null): string | null {
  if (!release?.isVisible || release.ready !== true || !release.version?.trim() ||
      !Number.isSafeInteger(release.versionCode) || (release.versionCode ?? 0) <= 0 ||
      !Number.isSafeInteger(release.sizeBytes) || (release.sizeBytes ?? 0) <= 0 ||
      !/^[a-f\d]{64}$/i.test(release.sha256 ?? '')) return null

  return safeApkDownloadUrl(release.apkUrl)
}

export function MobileDownloadLink({ release }: MobileDownloadLinkProps) {
  const href = readyMobileDownloadUrl(release)
  if (!href) return null

  return (
    <a className="mobile-download-link" href={href} rel="noopener noreferrer" target="_blank">
      <Download size={17} aria-hidden="true" />
      Android tətbiqini yüklə
    </a>
  )
}
