import type { CurrentUser, UserAccessProfile } from './jwt'
import { profileKey, readStoredProfileKey } from './activeProfileStorage'

type ProfileDetails = {
  roleId?: number
  fileUrl?: string
  profiles: Array<{ restaurantId: string; restaurantName: string; roleId: number; roleName: string; isActive: boolean }>
}

export function hasNoActiveStaffProfile(user: CurrentUser, details: ProfileDetails) {
  const role = String(details.roleId || user.roleId)
  return ['2', '3', '4', '6'].includes(role) && !details.profiles.some(profile => profile.isActive && ['2', '3', '4', '6'].includes(String(profile.roleId)))
}

export function profileSignature(profiles: UserAccessProfile[]) {
  return profiles.map(profile => `${profileKey(profile)}:${profile.restaurantName || ''}:${profile.roleName || ''}:${profile.isActive !== false}`).sort().join('|')
}

export function profileScope(user: CurrentUser | null) {
  return user ? `${user.userId}:${['1', '5'].includes(user.roleId) ? '' : user.restaurantId || ''}:${user.roleId}` : ''
}

export function assignmentSignature(profiles: Array<{ restaurantId: string; roleId: string }>) {
  return profiles.map(profileKey).sort().join('|')
}

export function withSelectedProfile(user: CurrentUser | null, preferred?: Pick<UserAccessProfile, 'restaurantId' | 'roleId'> | null) {
  if (!user) return null
  const profiles = user.profiles.filter(profile => profile.isActive !== false)
  if (user.roleId === '1' && (!preferred || preferred.roleId === '1')) return { ...user, profiles }
  if (!profiles.length) return user.roleId === '5' ? { ...user, restaurantId: undefined, restaurantIds: [], restaurantRoles: [], permissions: [] } : user
  const storedKey = readStoredProfileKey(user.userId)
  const selected = profiles.find(profile => preferred && profileKey(profile) === profileKey(preferred)) ||
    profiles.find(profile => profileKey(profile) === storedKey) ||
    profiles.find(profile => profile.restaurantId === user.restaurantId && profile.roleId === user.roleId) || profiles[0]
  return { ...user, restaurantId: selected.restaurantId, roleId: selected.roleId, roleName: selected.roleName || user.roleName, profiles }
}

export function mergeProfileDetails(user: CurrentUser, details: ProfileDetails, preferred = user) {
  const profiles: UserAccessProfile[] = details.profiles.filter(profile => profile.isActive && profile.restaurantId && profile.roleId).map(profile => ({
    ...profile, restaurantId: String(profile.restaurantId), roleId: String(profile.roleId),
  }))
  const next = {
    ...user, fileUrl: details.fileUrl || user.fileUrl, profiles,
    roleId: user.roleId === '1' && details.roleId && details.roleId !== 1 ? String(details.roleId) : user.roleId,
    permissions: user.roleId === '1' && details.roleId && details.roleId !== 1 ? [] : user.permissions,
    restaurantRoles: profiles.map(({ restaurantId, roleId }) => ({ restaurantId, roleId })),
    restaurantIds: [...new Set(profiles.map(profile => profile.restaurantId))],
  }
  if (details.roleId === 1 && preferred.roleId === '1') return { ...next, roleId: '1', restaurantId: undefined }
  if (!profiles.length) {
    const platformAdmin = details.roleId === 1 || (!details.roleId && user.roleId === '1')
    const roleId = String(details.roleId || user.roleId)
    const staff = ['2', '3', '4', '6'].includes(roleId)
    return { ...next, restaurantId: undefined, roleId: platformAdmin ? '1' : staff ? roleId : '5', roleName: platformAdmin ? 'PlatformAdmin' : staff ? user.roleName : 'Customer', permissions: platformAdmin ? user.permissions : [] }
  }
  // Preserve the tab's current selection; a JWT's default restaurant is not a navigation request.
  return withSelectedProfile(next, { restaurantId: preferred.restaurantId || '', roleId: preferred.roleId })!
}

export function sameAccessState(left: CurrentUser, right: CurrentUser) {
  return profileScope(left) === profileScope(right) && profileSignature(left.profiles) === profileSignature(right.profiles) &&
    assignmentSignature(left.restaurantRoles) === assignmentSignature(right.restaurantRoles) && left.fileUrl === right.fileUrl &&
    left.restaurantIds.slice().sort().join('|') === right.restaurantIds.slice().sort().join('|') &&
    left.roleName === right.roleName && left.permissions.join('|') === right.permissions.join('|')
}
