import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { Brand } from '../../shared/layout/Brand'
import { Button } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/FormField'
import { StatusMessage } from '../../shared/ui/StatusMessage'

export function SetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageDetails, setMessageDetails] = useState<ApiErrorDetail[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setMessageDetails([])

    if (!token) {
      setMessage('Şifrə təyin etmə linki yanlışdır və ya token tapılmadı.')
      setMessageDetails([])
      return
    }

    setIsSubmitting(true)
    try {
      await ecafeApi.auth.setPassword({ token, password, confirmPassword })
      setMessage('Şifrəniz təyin edildi. İndi hesabınıza daxil ola bilərsiniz.')
      setTimeout(() => navigate('/login', { replace: true }), 1200)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Şifrə təyin edilmədi.')
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
          <h1>Şifrə təyin et</h1>
          <p>ECafe hesabınız üçün yeni şifrə yaradın.</p>
        </div>
        <TextField label="Yeni şifrə" placeholder="••••••••" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <TextField label="Şifrəni təkrar yaz" placeholder="••••••••" required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
        <Button disabled={isSubmitting || !token} type="submit">{isSubmitting ? 'Yadda saxlanılır...' : 'Şifrəni yadda saxla'}</Button>
        <Link to="/login">Giriş səhifəsinə qayıt</Link>
      </form>
    </main>
  )
}
