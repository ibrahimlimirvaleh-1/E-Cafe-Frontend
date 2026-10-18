import { i18n } from '../../shared/i18n/i18n'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { getHomePathForUser } from '../../shared/auth/authz'
import { getUserFromToken } from '../../shared/auth/jwt'
import { Brand } from '../../shared/layout/Brand'
import { Button } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/FormField'
import { PhoneField } from '../../shared/ui/PhoneField'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type AuthPageProps = {
  mode: 'login' | 'register'
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errorDetails, setErrorDetails] = useState<ApiErrorDetail[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setErrorDetails([])
    const validationDetails = validateAuthForm({ email, isLogin, name, password, phone, surname })

    if (validationDetails.length > 0) {
      setError(isLogin ? 'Giriş məlumatlarında düzəldilməli sahələr var.' : 'Qeydiyyat məlumatlarında düzəldilməli sahələr var.')
      setErrorDetails(validationDetails)
      return
    }

    setIsSubmitting(true)

    try {
      const tokens = isLogin
        ? await ecafeApi.auth.login({ email, password })
        : await ecafeApi.auth.register({
            name: name.trim(),
            surname: surname.trim(),
            email,
            phone,
            password,
          })

      if (!tokens.accessToken) {
        throw new Error('Token məlumatı geri qayıtmadı.')
      }

      setSession(tokens)
      const user = getUserFromToken(tokens.accessToken)
      const redirectTo = getHomePathForUser(user)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, isLogin ? 'Giriş mümkün olmadı.' : 'Qeydiyyat tamamlanmadı.')
      setError(feedback.message)
      setErrorDetails(feedback.details)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <Brand />
        <div>
          <h1>{isLogin ?i18n.t('ui.pages.auth.auth_page.daxil_ol_2e157a') :i18n.t('ui.pages.auth.auth_page.qeydiyyat_5ca601')}</h1>
          <p>{isLogin ?i18n.t('ui.pages.auth.auth_page.ecafe_hesabina_giris_et_1872e8') :i18n.t('ui.pages.auth.auth_page.musteri_hesabi_yarat_ve_rezervasiyalar_3db029')}</p>
        </div>
        {!isLogin ? (
          <>
            <TextField label={i18n.t('ui.pages.auth.auth_page.ad_1d97c9')} placeholder={i18n.t('ui.pages.auth.auth_page.adinizi_daxil_edin_b76c99')} value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label={i18n.t('ui.pages.auth.auth_page.soyad_3d89d4')} placeholder={i18n.t('ui.pages.auth.auth_page.soyadinizi_daxil_edin_4ffd42')} value={surname} onChange={(event) => setSurname(event.target.value)} />
            <PhoneField label={i18n.t('ui.pages.auth.auth_page.telefon_fa6906')} value={phone} onChange={setPhone} />
          </>
        ) : null}
        <TextField label={i18n.t('ui.pages.auth.auth_page.email_969ccb')} placeholder={i18n.t('ui.pages.auth.auth_page.name_example_com_7b17fb')} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField label={i18n.t('ui.pages.auth.auth_page.sifre_bc0691')} placeholder={i18n.t('ui.pages.auth.auth_page.en_azi_8_simvol_24a804')} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <StatusMessage details={errorDetails} tone="danger">{error}</StatusMessage> : null}
        <Button disabled={isSubmitting} type="submit">{isSubmitting ?i18n.t('ui.pages.auth.auth_page.gonderilir_e1bb27') : isLogin ?i18n.t('ui.pages.auth.auth_page.daxil_ol_2e157a') :i18n.t('ui.pages.auth.auth_page.hesab_yarat_54e62f')}</Button>
        <div className="auth-links">
          {isLogin ? <Link to="/forgot-password">{i18n.t('ui.pages.auth.auth_page.sifreni_unutmusunuz_b8c2d0')}</Link> : null}
          <Link to={isLogin ? '/register' : '/login'}>{isLogin ?i18n.t('ui.pages.auth.auth_page.yeni_hesab_yarat_d8d36c') :i18n.t('ui.pages.auth.auth_page.hesabim_var_1d8182')}</Link>
        </div>
      </form>
    </main>
  )
}

function validateAuthForm({
  email,
  isLogin,
  name,
  password,
  phone,
  surname,
}: {
  email: string
  isLogin: boolean
  name: string
  password: string
  phone: string
  surname: string
}): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = []
  const normalizedEmail = email.trim()
  const normalizedPhone = phone.replace(/[\s-]/g, '')

  if (!isLogin && name.trim().length < 2) {
    details.push({ field: 'Name', label: 'Ad', message: 'Ad ən azı 2 simvol olmalıdır.' })
  }

  if (!isLogin && surname.trim().length < 2) {
    details.push({ field: 'Surname', label: 'Soyad', message: 'Soyad ən azı 2 simvol olmalıdır.' })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    details.push({ field: 'Email', label: 'Email', message: 'Düzgün email formatı daxil edin.' })
  }

  if (!isLogin && !/^(\+994|0)(50|51|55|70|77|99|10)\d{7}$/.test(normalizedPhone)) {
    details.push({ field: 'Phone', label: 'Telefon', message: 'Operator kodunu seçin və 7 rəqəmli nömrəni daxil edin.' })
  }

  if (password.length < 8) {
    details.push({ field: 'Password', label: 'Şifrə', message: 'Şifrə ən azı 8 simvol olmalıdır.' })
  }

  if (!isLogin && !/[A-ZƏÖÜĞÇŞİ]/.test(password)) {
    details.push({ field: 'Password', label: 'Şifrə', message: 'Şifrədə ən azı bir böyük hərf olmalıdır.' })
  }

  if (!isLogin && !/\d/.test(password)) {
    details.push({ field: 'Password', label: 'Şifrə', message: 'Şifrədə ən azı bir rəqəm olmalıdır.' })
  }

  return details
}
