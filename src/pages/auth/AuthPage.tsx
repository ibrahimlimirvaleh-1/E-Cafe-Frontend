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
          <h1>{isLogin ? 'Daxil ol' : 'Qeydiyyat'}</h1>
          <p>{isLogin ? 'ECafe hesabına giriş et.' : 'Müştəri hesabı yarat və rezervasiyalarını izlə.'}</p>
        </div>
        {!isLogin ? (
          <>
            <TextField label="Ad" placeholder="Adınızı daxil edin" value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label="Soyad" placeholder="Soyadınızı daxil edin" value={surname} onChange={(event) => setSurname(event.target.value)} />
            <PhoneField label="Telefon" value={phone} onChange={setPhone} />
          </>
        ) : null}
        <TextField label="Email" placeholder="name@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField label="Şifrə" placeholder="Ən azı 8 simvol" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <StatusMessage details={errorDetails} tone="danger">{error}</StatusMessage> : null}
        <Button disabled={isSubmitting} type="submit">{isSubmitting ? 'Göndərilir...' : isLogin ? 'Daxil ol' : 'Hesab yarat'}</Button>
        {isLogin ? <Link to="/forgot-password">Şifrəni unutmusunuz?</Link> : null}
        <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Yeni hesab yarat' : 'Hesabım var'}</Link>
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
