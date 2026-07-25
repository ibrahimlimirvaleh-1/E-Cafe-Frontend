import { Upload } from 'lucide-react'
import { type ChangeEvent, useState } from 'react'
import { ecafeApi } from '../api/ecafeApi'

type FileUploadFieldProps = {
  label: string
  onUploaded: (fileId: number | null) => void
}

export function FileUploadField({ label, onUploaded }: FileUploadFieldProps) {
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setFileName('')
      onUploaded(null)
      return
    }

    setStatus('Yüklənir...')
    const uploaded = await ecafeApi.files.upload(file)
    setFileName(uploaded.fileName || file.name)
    setStatus(`Fayl #${uploaded.id}`)
    onUploaded(uploaded.id)
  }

  return (
    <label className="upload-field">
      <span>{label}</span>
      <input type="file" onChange={handleChange} />
      <strong>
        <Upload size={16} />
        {fileName || 'Fayl seç'}
      </strong>
      {status ? <small>{status}</small> : null}
    </label>
  )
}
