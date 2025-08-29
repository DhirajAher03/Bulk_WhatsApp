import axios from 'axios'
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
export const api = axios.create({ baseURL: API_BASE })

export async function fetchGroups() {
  const { data } = await api.get('/api/groups')
  return data.data.groups
}

export async function sendNow({ groupIds, message, perGroupDelayMs, file }) {
  const form = new FormData()
  form.append('message', message || '')
  form.append('groupIds', JSON.stringify(groupIds || []))
  form.append('perGroupDelayMs', String(perGroupDelayMs || 1200))
  if (file) form.append('media', file)
  const { data } = await api.post('/api/send', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function scheduleSend({ groupIds, message, runAtISO, perGroupDelayMs, file }) {
  const form = new FormData()
  form.append('message', message || '')
  form.append('groupIds', JSON.stringify(groupIds || []))
  form.append('runAtISO', runAtISO)
  form.append('perGroupDelayMs', String(perGroupDelayMs || 1200))
  if (file) form.append('media', file)
  const { data } = await api.post('/api/schedule', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function jobs() {
  const { data } = await api.get('/api/jobs')
  return data.data.jobs
}
