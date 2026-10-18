import { i18n } from '../../shared/i18n/i18n'
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
          <h1>{i18n.t('ui.pages.auth.set_password_page.sifre_teyin_et_4f5448')}</h1>
          <p>{i18n.t('ui.pages.auth.set_password_page.ecafe_hesabiniz_ucun_yeni_sifre_yaradi_a48d0e')}</p>
        </div>
        <TextField label={i18n.t('ui.pages.auth.set_password_page.yeni_sifre_bdec18')} placeholder="••••••••" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <TextField label={i18n.t('ui.pages.auth.set_password_page.sifreni_tekrar_yaz_8f00aa')} placeholder="••••••••" required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
        <Button disabled={isSubmitting || !token} type="submit">{isSubmitting ?i18n.t('ui.pages.auth.set_password_page.yadda_saxlanilir_cac6f1') :i18n.t('ui.pages.auth.set_password_page.sifreni_yadda_saxla_fa8aec')}</Button>
        <Link to="/login">{i18n.t('ui.pages.auth.set_password_page.giris_sehifesine_qayit_82f2cf')}</Link>
      </form>
    </main>
  )
}
