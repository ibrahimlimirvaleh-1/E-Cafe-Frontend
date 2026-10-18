import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ecafeApi } from '../api/ecafeApi'
import { changeLanguage, getCurrentLanguage, i18n } from './i18n'
import { refreshDictionary } from './catalog'
import { hasStoredLanguageSelection, isLanguage } from './language'

export function LocalizationBridge() {
  const { user, isAuthReady } = useAuth()
  const profileSyncedFor = useRef('')

  useEffect(() => {
    const refresh = () => { if (!document.hidden) void refreshDictionary(getCurrentLanguage()).catch(() => {}) }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    const onLanguageChanged = () => { void refreshDictionary(getCurrentLanguage()).catch(() => {}) }
    i18n.on('languageChanged', onLanguageChanged)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      i18n.off('languageChanged', onLanguageChanged)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  useEffect(() => {
    if (!isAuthReady || !user?.userId || profileSyncedFor.current === user.userId) return
    profileSyncedFor.current = user.userId
    let active = true
    const localWasSelected = hasStoredLanguageSelection()
    const initialLanguage = getCurrentLanguage()
    void ecafeApi.localization.getPreference().then(async (preference) => {
      if (!active || !isLanguage(preference.language)) return
      if (localWasSelected || getCurrentLanguage() !== initialLanguage) {
        if (preference.language !== getCurrentLanguage()) {
          await ecafeApi.localization.setPreference(getCurrentLanguage())
        }
      } else {
        await changeLanguage(preference.language)
      }
    }).catch(() => {})
    return () => { active = false }
  }, [isAuthReady, user?.userId])

  return null
}
