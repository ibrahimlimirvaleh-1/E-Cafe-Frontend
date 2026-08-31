import { Upload } from 'lucide-react'
import { type ChangeEvent, useState } from 'react'
import { ecafeApi } from '../api/ecafeApi'
import { normalizeCaughtApiError } from '../api/httpClient'

type FileUploadFieldProps = {
  label: string
  accept?: string
  maxSizeMb?: number
  onUploaded: (fileId: number | null) => void
}

export function FileUploadField({ label, accept, maxSizeMb = 10, onUploaded }: FileUploadFieldProps) {
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setFileName('')
      setStatus('')
      setError('')
      onUploaded(null)
      return
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      event.target.value = ''
      setFileName('')
      setStatus('')
      setError(`Fayl çox böyükdür. Maksimum ${maxSizeMb} MB fayl seçin.`)
      onUploaded(null)
      return
    }

    setStatus('Yüklənir...')
    setError('')

    try {
      const uploaded = await ecafeApi.files.upload(file)
      setFileName(uploaded.fileName || file.name)
      setStatus(`Fayl #${uploaded.id}`)
      onUploaded(uploaded.id)
    } catch (err) {
      event.target.value = ''
      setFileName('')
      setStatus('')
      setError(normalizeCaughtApiError(err, 'Fayl yüklənmədi. Zəhmət olmasa yenidən cəhd edin.').message)
      onUploaded(null)
    }
  }

  return (
    <label className="upload-field">
      <span>{label}</span>
      <input type="file" accept={accept} onChange={handleChange} />
      <strong>
        <Upload size={16} />
        {fileName || 'Fayl seç'}
      </strong>
      {status ? <small>{status}</small> : null}
      {error ? <small className="upload-error">{error}</small> : null}
    </label>
  )
}
