import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { SafeImage } from '../../shared/ui/SafeImage'

export function RestaurantPhotoDialog({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(<dialog ref={dialogRef} className="restaurant-photo-dialog" aria-label={name} onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => {
    if (event.key === 'Tab') {
      event.preventDefault()
      dialogRef.current?.querySelector('button')?.focus()
    }
  }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="restaurant-photo-dialog-content">
      <header><strong>{name}</strong><button type="button" onClick={onClose} aria-label={t('ui.common.close')} title={t('ui.common.close')}><X size={22} aria-hidden="true" /></button></header>
      <SafeImage src={src} alt={name} />
    </div>
  </dialog>, document.body)
}
