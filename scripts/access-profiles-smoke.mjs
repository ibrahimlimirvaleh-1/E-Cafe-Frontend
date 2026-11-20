import assert from 'node:assert/strict'
import vm from 'node:vm'
import path from 'node:path'
import { buildSync } from 'esbuild'

const bundle = buildSync({ stdin: {
  contents: `export * from './src/shared/auth/accessProfiles'; export * from './src/shared/auth/activeProfileStorage'; export * from './src/shared/auth/tokenStorage'; export { hasPermission, getRestaurantRoleId } from './src/shared/auth/authz';`,
  resolveDir: path.resolve('.'), loader: 'ts',
}, bundle: true, write: false, format: 'iife', globalName: 'AccessProfiles', platform: 'browser' }).outputFiles[0].text
const store = new Map()
const window = { location: { protocol: 'https:', pathname: '/' }, localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }, sessionStorage: { removeItem() {} } }
const context = vm.createContext({ window, document: { cookie: '' }, atob, console })
vm.runInContext(bundle, context)
const api = context.AccessProfiles
const profiles = [
  { restaurantId: '1', restaurantName: 'R1', roleId: '2', roleName: 'Owner', isActive: true },
  { restaurantId: '2', restaurantName: 'R2', roleId: '3', roleName: 'Manager', isActive: true },
]
const user = { userId: '42', name: 'Test', surname: 'Owner', email: 'test@example.com', roleId: '2', roleName: 'Owner', restaurantId: '1', restaurantIds: ['1', '2'], restaurantRoles: profiles.map(({ restaurantId, roleId }) => ({ restaurantId, roleId })), profiles, permissions: ['ManageStaff'] }
const details = list => ({ roleId: list.length ? Number(list[0].roleId) : 5, profiles: list.map(item => ({ ...item, roleId: Number(item.roleId) })) })
const token = value => `header.${Buffer.from(JSON.stringify({ ...value, restaurantRoles: value.restaurantRoles.map(item => `${item.restaurantId}:${item.roleId}`) })).toString('base64url')}.signature`
let cases = 0

window.localStorage.setItem('ecafe.activeProfile.42', '1:2')
const selected = api.withSelectedProfile(user, profiles[1])
assert.equal(selected.restaurantId, '2'); cases += 1
const otherRemoved = api.mergeProfileDetails(selected, details([profiles[1]]))
assert.equal(api.profileScope(otherRemoved), api.profileScope(selected))
assert.equal(api.getRestaurantRoleId(otherRemoved, '1'), undefined)
assert.equal(otherRemoved.restaurantRoles.length, 1); cases += 1
const currentRemoved = api.mergeProfileDetails(user, details([profiles[1]]))
assert.equal(currentRemoved.restaurantId, '2'); assert.equal(currentRemoved.roleId, '3'); cases += 1
const empty = api.mergeProfileDetails(user, details([]))
assert.equal(empty.roleId, '5'); assert.equal(empty.restaurantId, undefined)
assert.equal(empty.restaurantRoles.length, 0); assert.equal(empty.restaurantIds.length, 0)
assert.equal(empty.profiles.length, 0); assert.equal(empty.permissions.length, 0)
assert.equal(api.hasPermission(empty, 'ManageStaff'), false); cases += 1

api.saveAuthTokens({ accessToken: token(user) })
api.syncVerifiedProfiles(empty)
assert.equal(api.getActiveProfileContext(), null, 'Empty server list wins over stale JWT')
assert.equal(window.localStorage.getItem('ecafe.activeProfile.42'), null); cases += 1
api.saveAuthTokens({ accessToken: token(user) })
assert.equal(api.getActiveProfileContext(), null, 'Normal refresh does not resurrect an authoritative empty list'); cases += 1

api.syncVerifiedProfiles(selected)
window.localStorage.setItem('ecafe.activeProfile.42', '1:2')
assert.equal(api.getActiveProfileContext().restaurantId, '2', 'Another tab storage choice cannot change current tab headers'); cases += 1
const changedRole = api.mergeProfileDetails(user, details([{ ...profiles[0], roleId: '4', roleName: 'Waiter' }, profiles[1]]))
assert.equal(changedRole.restaurantId, '1'); assert.equal(changedRole.roleId, '4'); cases += 1
api.syncVerifiedProfiles(empty)
const reactivated = api.mergeProfileDetails(empty, details([profiles[0]]))
assert.equal(reactivated.restaurantId, '1'); assert.equal(reactivated.roleId, '2'); cases += 1

const admin = { ...user, roleId: '1', profiles: [], restaurantRoles: [], permissions: ['ManageStaff'] }
const adminResult = api.mergeProfileDetails(admin, { roleId: 1, profiles: [] })
assert.equal(adminResult.roleId, '1'); assert.equal(api.profileScope(adminResult), api.profileScope(admin)); cases += 1
const demoted = api.mergeProfileDetails(admin, details([profiles[1]]))
assert.equal(demoted.roleId, '3'); assert.equal(demoted.restaurantId, '2')
assert.equal(api.hasPermission(demoted, 'ManageUsers'), false); assert.equal(demoted.permissions.length, 0); cases += 1
const adminWithMemberships = api.mergeProfileDetails(admin, { ...details(profiles), roleId: 1 })
assert.equal(adminWithMemberships.roleId, '1'); assert.equal(adminWithMemberships.restaurantId, undefined)
assert.equal(api.hasPermission(adminWithMemberships, 'ManageUsers'), true); cases += 1
const filtered = api.mergeProfileDetails(user, details([{ ...profiles[0], isActive: false }, profiles[1]]))
assert.equal(filtered.profiles.length, 1); assert.equal(filtered.restaurantId, '2'); cases += 1
assert.equal(api.sameAccessState(empty, api.mergeProfileDetails(empty, details([]))), true); cases += 1
api.saveAuthTokens({ accessToken: token({ ...user, userId: '84' }) })
assert.equal(api.getActiveProfileContext().restaurantId, '1', 'Verified context belongs to its account'); cases += 1
api.clearVerifiedProfiles()
api.saveAuthTokens({ accessToken: token(user) })
assert.equal(api.getActiveProfileContext().restaurantId, '1', 'Explicit login can reset the verified context'); cases += 1
console.log(`PASS ${cases} access-profile rules: authoritative empty/filtered lists, current/other removal, fallback/reactivation, permissions, global admin, per-tab headers and fresh login`)
