import { Upload } from 'lucide-react'
import { type ChangeEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ecafeApi } from '../api/ecafeApi'
import { ApiError } from '../api/httpClient'

type FileUploadFieldProps = {
  label: string
  accept?: string
  maxSizeMb?: number
  onUploaded: (fileId: number | null) => void
}

type UploadStatus = { kind: 'uploading' } | { kind: 'uploaded'; id: number } | null
type UploadError = { kind: 'tooLarge'; maxSizeMb: number } | { kind: 'failed' } | { kind: 'server'; message: string } | null

export function FileUploadField({ label, accept, maxSizeMb = 10, onUploaded }: FileUploadFieldProps) {
  const { t } = useTranslation()
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<UploadStatus>(null)
  const [error, setError] = useState<UploadError>(null)

  // Ölçünü yoxlayıb faylı yükləyir, nəticə ID-sini və ya null-u ötürür; lokal mətnlər renderdə çevrilir.
  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setFileName('')
      setStatus(null)
      setError(null)
      onUploaded(null)
      return
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      event.target.value = ''
      setFileName('')
      setStatus(null)
      setError({ kind: 'tooLarge', maxSizeMb })
      onUploaded(null)
      return
    }

    setStatus({ kind: 'uploading' })
    setError(null)

    try {
      const uploaded = await ecafeApi.files.upload(file)
      setFileName(uploaded.fileName || file.name)
      setStatus({ kind: 'uploaded', id: uploaded.id })
      onUploaded(uploaded.id)
    } catch (err) {
      event.target.value = ''
      setFileName('')
      setStatus(null)
      // HTTP cavabı olmayan şəbəkə xətası dil dəyişəndə yenidən tərcümə olunmalıdır.
      setError(err instanceof ApiError && err.statusCode > 0 ? { kind: 'server', message: err.message } : { kind: 'failed' })
      onUploaded(null)
    }
  }

  return (
    <label className="upload-field">
      <span>{label}</span>
      <input type="file" accept={accept} onChange={handleChange} />
      <strong>
        <Upload size={16} />
        {fileName || t('ui.fileUpload.choose')}
      </strong>
      {status ? <small>{status.kind === 'uploading' ? t('ui.fileUpload.uploading') : t('ui.fileUpload.uploaded', { id: status.id })}</small> : null}
      {error ? <small className="upload-error">{error.kind === 'tooLarge' ? t('ui.fileUpload.tooLarge', { maxSizeMb: error.maxSizeMb }) : error.kind === 'server' ? error.message : t('ui.fileUpload.failed')}</small> : null}
    </label>
  )
}
