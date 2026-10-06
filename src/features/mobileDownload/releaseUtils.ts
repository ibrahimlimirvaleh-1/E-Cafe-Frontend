import type { MobileRelease } from './mobileDownloadApi'

export function isReadyMobileRelease(release: MobileRelease | null, downloadPath: string): release is MobileRelease {
  return release?.ready === true &&
    release.downloadPath === downloadPath &&
    Boolean(release.version?.trim()) &&
    Number.isSafeInteger(release.versionCode) && (release.versionCode ?? 0) > 0 &&
    Number.isSafeInteger(release.sizeBytes) && (release.sizeBytes ?? 0) > 0 &&
    /^[a-f\d]{64}$/i.test(release.sha256 ?? '')
}

export function saveMobileRelease(blob: Blob, release: MobileRelease) {
  if (blob.size !== release.sizeBytes) throw new Error('APK ölçüsü uyğun gəlmir.')

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ECafe-${release.version!.replace(/[^a-zA-Z0-9.-]/g, '')}.apk`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
