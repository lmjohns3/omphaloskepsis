import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import { useGeo } from './geo.jsx'


const csrfHeader = () => ({
  'x-omphalos-csrf': document.getElementById('csrf-token').getAttribute('content')
})


const url = path => `/api/${path}/`


const fetchJson = (url, args) => fetch(url, args)
      .catch(console.error)
      .then(res => {
        if (res.ok) return res.json()
        throw new Error(`${url}: got ${res.status} ${res.statusText}`)
      })


const apiCreate = (path, args) => useGeo().then(geo => apiUpdate(path, {
  utc: dayjs.utc().unix(),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  ...geo,
  ...args,
}))


const apiRead = (path, args) => fetchJson(url(path) + '?' + new URLSearchParams(args))


const apiUpdate = (path, args) => fetchJson(url(path), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json;charset=utf-8', ...csrfHeader() },
  body: JSON.stringify(args)
})


const apiDelete = path => fetchJson(url(path), { method: 'DELETE', headers: csrfHeader() })


const apiPost = apiUpdate


export { apiCreate, apiRead, apiUpdate, apiDelete, apiPost }
