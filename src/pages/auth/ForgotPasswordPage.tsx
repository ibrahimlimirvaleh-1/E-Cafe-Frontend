import { i18n } from '../../shared/i18n/i18n'
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
          <h1>{i18n.t('ui.pages.auth.forgot_password_page.sifreni_yenile_de20a9')}</h1>
          <p>{i18n.t('ui.pages.auth.forgot_password_page.email_unvaninizi_yazin_sistem_size_teh_e2db13')}</p>
        </div>
        <TextField
          label={i18n.t('ui.pages.auth.forgot_password_page.email_969ccb')}
          placeholder={i18n.t('ui.pages.auth.forgot_password_page.name_example_com_7b17fb')}
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
          {isSubmitting ?i18n.t('ui.pages.auth.forgot_password_page.gonderilir_e1bb27') :i18n.t('ui.pages.auth.forgot_password_page.link_gonder_57e67c')}
        </Button>
        <Link to="/login">{i18n.t('ui.pages.auth.forgot_password_page.giris_sehifesine_qayit_82f2cf')}</Link>
      </form>
    </main>
  )
}
