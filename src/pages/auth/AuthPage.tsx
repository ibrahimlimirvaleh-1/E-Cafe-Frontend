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
import { StatusMessage } from '../../shared/ui/StatusMessage'

type AuthPageProps = {
  mode: 'login' | 'register'
}

function splitFullName(fullName: string) {
  const [name = '', ...rest] = fullName.trim().split(/\s+/)
  return {
    name,
    surname: rest.join(' ') || name,
  }
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [fullName, setFullName] = useState('')
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
    setIsSubmitting(true)

    try {
      const tokens = isLogin
        ? await ecafeApi.auth.login({ email, password })
        : await ecafeApi.auth.register({ ...splitFullName(fullName), email, phone, password })

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
            <TextField label="Ad və soyad" placeholder="Aysel Məmmədova" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            <TextField label="Telefon" placeholder="+994501234567" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </>
        ) : null}
        <TextField label="Email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField label="Şifrə" placeholder="••••••••" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <StatusMessage details={errorDetails} tone="danger">{error}</StatusMessage> : null}
        <Button disabled={isSubmitting} type="submit">{isSubmitting ? 'Göndərilir...' : isLogin ? 'Daxil ol' : 'Hesab yarat'}</Button>
        {isLogin ? <Link to="/forgot-password">Şifrəni unutmusunuz?</Link> : null}
        <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Yeni hesab yarat' : 'Hesabım var'}</Link>
      </form>
    </main>
  )
}
