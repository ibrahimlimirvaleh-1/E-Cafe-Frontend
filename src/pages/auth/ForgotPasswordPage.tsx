import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { Brand } from '../../shared/layout/Brand'
import { Button } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/FormField'
import { StatusMessage } from '../../shared/ui/StatusMessage'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [messageDetails, setMessageDetails] = useState<ApiErrorDetail[]>([])
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setMessageDetails([])
    setIsSubmitting(true)

    try {
      await ecafeApi.auth.forgotPassword({ email })
      setMessageTone('success')
      setMessage('Əgər bu email sistemdə varsa, şifrə yeniləmə linki göndərildi.')
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Şifrə yeniləmə sorğusu göndərilmədi.')
      setMessageTone('danger')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <Brand />
        <div>
          <h1>Şifrəni yenilə</h1>
          <p>Email ünvanınızı yazın, sistem sizə təhlükəsiz yeniləmə linki göndərsin.</p>
        </div>
        <TextField
          label="Email"
          placeholder="name@example.com"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {message ? (
          <StatusMessage details={messageDetails} tone={messageTone}>
            {message}
          </StatusMessage>
        ) : null}
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Göndərilir...' : 'Link göndər'}
        </Button>
        <Link to="/login">Giriş səhifəsinə qayıt</Link>
      </form>
    </main>
  )
}
