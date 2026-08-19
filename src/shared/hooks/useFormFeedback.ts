import { useState } from 'react'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../api/httpClient'

export type FormFeedback = {
  details: ApiErrorDetail[]
  message: string
  tone?: 'success' | 'danger' | 'warning' | 'info'
}

export function useFormFeedback() {
  const [feedback, setFeedback] = useState<FormFeedback>({ details: [], message: '' })

  return {
    feedback,
    clearFeedback: () => setFeedback({ details: [], message: '' }),
    setError: (error: unknown, fallbackMessage: string) => {
      const apiError = normalizeCaughtApiError(error, fallbackMessage)
      setFeedback({ details: apiError.details, message: apiError.message, tone: 'danger' })
    },
    setSuccess: (message: string) => setFeedback({ details: [], message, tone: 'success' }),
    setWarning: (message: string) => setFeedback({ details: [], message, tone: 'warning' }),
  }
}
