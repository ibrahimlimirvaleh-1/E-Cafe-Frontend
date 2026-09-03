import { getUserFromToken } from './jwt'
import { getAccessToken } from './tokenStorage'
import type { UserAccessProfile } from './jwt'

const ACTIVE_PROFILE_STORAGE_KEY = 'ecafe.activeProfile'

function profileKey(profile: Pick<UserAccessProfile, 'restaurantId' | 'roleId'>) {
  return `${profile.restaurantId}:${profile.roleId}`
}

export function readStoredProfileKey(userId: string) {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(`${ACTIVE_PROFILE_STORAGE_KEY}.${userId}`) || ''
}

export function writeStoredProfileKey(userId: string, profile: Pick<UserAccessProfile, 'restaurantId' | 'roleId'>) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(`${ACTIVE_PROFILE_STORAGE_KEY}.${userId}`, profileKey(profile))
}

export function getActiveProfileContext() {
  const token = getAccessToken()
  const user = token ? getUserFromToken(token) : null

  if (!user) {
    return null
  }

  const storedProfileKey = readStoredProfileKey(user.userId)
  const profiles = user.profiles.length > 0
    ? user.profiles
    : user.restaurantRoles.map((assignment) => ({ ...assignment }))
  const selectedProfile =
    profiles.find((profile) => profileKey(profile) === storedProfileKey) ||
    profiles.find((profile) => profile.restaurantId === user.restaurantId && profile.roleId === user.roleId) ||
    profiles[0]

  if (!selectedProfile?.restaurantId || !selectedProfile.roleId) {
    return null
  }

  return {
    restaurantId: selectedProfile.restaurantId,
    roleId: selectedProfile.roleId,
  }
}

export { profileKey }
