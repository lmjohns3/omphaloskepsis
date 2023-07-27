import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import { useGeo } from './geo.jsx'


const csrfHeader = () => ({
  'x-omphaloskepsis-csrf': document.getElementById('csrf').getAttribute('token')
})


const api = path => `/api/${path}/`


const fetchJson = (url, args, timeoutSec = 10) => fetch(
  url, { ...args, signal: AbortSignal.timeout(1000 * timeoutSec) }
).then(res => {
  if (res.status < 300) return res.json()
  if (res.status < 500) return null
  throw new Error(JSON.stringify({ url, res }))
})


const apiCreate = (path, args) => useGeo().then(geo => apiUpdate(path, {
  utc: dayjs.utc().unix(),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  ...(geo?.coords ? { lat: geo.coords.latitude, lng: geo.coords.longitude }: {}),
  ...args,
}))


const apiDelete = path => fetchJson(api(path), { method: 'DELETE', headers: csrfHeader() })


const apiRead = (path, args) => fetchJson(api(path) + '?' + new URLSearchParams(args))


const apiUpdate = (path, args) => fetchJson(api(path), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json;charset=utf-8', ...csrfHeader() },
  body: JSON.stringify(args)
})


export { apiCreate, apiDelete, apiRead, apiUpdate }
