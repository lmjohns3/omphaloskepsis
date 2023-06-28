import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import { useGeo } from './geo.jsx'


const csrfHeader = () => ({
  'x-omphaloskepsis-csrf': document.getElementById('csrf').getAttribute('content')
})


const api = path => `/api/${path}/`


const fetchJson = (url, args) => fetch(url, args)
      .catch(console.error)
      .then(res => {
        if (res.ok) return res.json()
        throw new Error(`${url}: got ${res.status} ${res.statusText}`)
      })


const apiCreate = (path, args) => useGeo().then(geo => apiUpdate(path, {
  utc: dayjs.utc().unix(),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  ...(geo?.coords ? { lat: geo.coords.latitude, lng: geo.coords.longitude }: {}),
  ...args,
}))


const apiRead = (path, args) => fetchJson(api(path) + '?' + new URLSearchParams(args))


const apiUpdate = (path, args) => fetchJson(api(path), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json;charset=utf-8', ...csrfHeader() },
  body: JSON.stringify(args)
})


const apiDelete = path => fetchJson(api(path), { method: 'DELETE', headers: csrfHeader() })


const apiPost = apiUpdate


export { apiCreate, apiRead, apiUpdate, apiDelete, apiPost }
