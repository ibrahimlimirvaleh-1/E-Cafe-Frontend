import type { RestaurantWorkingHour } from '../../entities/types'
import { httpClient } from '../../shared/api/httpClient'
import { endpoints } from '../../shared/api/endpoints'

export type ScheduleParticipant = {
  id: number; reservationId: number | null; tableSessionId: number | null
  tableName: string; customerName: string | null; arrivalAt: string
  proposedVacateAt: string | null; state: 'Pending' | 'Accepted' | 'Rejected'
  canAccept: boolean; responseNote: string | null
}
export type ScheduleChange = {
  id: number; token: string; state: 'Pending' | 'Applied' | 'Withdrawn'
  reason: string; timeZone: string; workingHours: RestaurantWorkingHour[]
  participants: ScheduleParticipant[]; canApply: boolean
}
export type ScheduleOffer = {
  changeId: number; consentId: number; token: string
  state: 'Pending' | 'Accepted' | 'Rejected' | 'Applied' | 'Withdrawn'
  reason: string; timeZone: string; proposedVacateAt: string | null
  canAccept: boolean; canRespond: boolean
}
function normalizeChange(change: ScheduleChange | null) {
  return change ? { ...change, workingHours: change.workingHours.map(hour => ({
    ...hour, opensAt: hour.opensAt.slice(0, 5), closesAt: hour.closesAt.slice(0, 5),
  })) } : null
}

export const scheduleApi = {
  get: async (id: string) => normalizeChange((await httpClient<ScheduleChange | null>(endpoints.schedule.get(id))).data),
  propose: async (id: string, workingHours: RestaurantWorkingHour[], reason: string) =>
    normalizeChange((await httpClient<ScheduleChange>(endpoints.schedule.get(id), { method: 'POST', body: JSON.stringify({ workingHours, reason }) })).data)!,
  apply: async (id: string, token: string) =>
    normalizeChange((await httpClient<ScheduleChange>(endpoints.schedule.apply(id), { method: 'POST', body: JSON.stringify({ token }) })).data)!,
  withdraw: async (id: string, token: string) =>
    normalizeChange((await httpClient<ScheduleChange>(endpoints.schedule.withdraw(id), { method: 'POST', body: JSON.stringify({ token }) })).data)!,
  session: async (id: string, consentId: number, token: string, accept: boolean, note: string) =>
    normalizeChange((await httpClient<ScheduleChange>(endpoints.schedule.session(id, consentId),
      { method: 'POST', body: JSON.stringify({ token, accept, note }) })).data)!,
  offer: async (id: string) => (await httpClient<ScheduleOffer | null>(endpoints.schedule.offer(id))).data,
  respond: async (id: string, token: string, accept: boolean) =>
    (await httpClient<ScheduleOffer>(endpoints.schedule.respond(id), { method: 'POST', body: JSON.stringify({ token, accept }) })).data,
}
