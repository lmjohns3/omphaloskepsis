import React, { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))

import { withGeo } from './geo.jsx'

import './common.styl'

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
const useInterval = (callback, delay) => {
  const cr = useRef()

  useEffect(() => {
    cr.current = callback
  }, [callback])

  useEffect(() => {
    if (delay) {
      const id = setInterval(() => cr.current(), delay)
      return () => clearInterval(id)
    }
  }, [delay])
}

const useRefresh = () => {
  const [_, setSerial] = useState(0)
  return () => setSerial(s => s + 1)
}

const useActivated = () => {
  const [isActivated, setIsActivated] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const outside = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsActivated(false)
      }
    }
    document.addEventListener('click', outside, true)
    return () => {
      document.removeEventListener('click', outside, true)
    }
  }, [])

  return [ref, isActivated, setIsActivated]
}

const csrfHeader = () => ({
  'x-omphalos-csrf': document.getElementById('csrf-token').getAttribute('content')
})

const loadFrom = (url, args, callback) => fetch(
  `/api/v1/${url}/?` + new URLSearchParams(args)
).then(res => res.json()).then(callback)

const postTo = (url, args, callback) => withGeo(geo => fetch(
  `/api/v1/${url}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      ...csrfHeader()
    },
    body: JSON.stringify({
      utc: dayjs.utc().unix(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...geo,
      ...args
    })
  }).then(res => res.json()).then(callback))

const deleteFrom = (url, callback) => fetch(
  `/api/v1/${url}/`, { method: 'DELETE', headers: csrfHeader() })
  .then(res => res.json()).then(callback)

const When = ({ utc, tz }) => {
  const t = dayjs.tz(utc, tz)
  return <div className='when'>
    <span className='year'>{t.format('YYYY')}</span>
    <span className='month'>{t.format('MMMM')}</span>
    <span className='day'>{t.format('Do')}</span>
    <span className='weekday'>({t.format('dddd')})</span>
    <span className='time'>{t.format('h:mm a')}</span>
  </div>
}

const roundTenths = x => x.toLocaleString(
  undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export {
  deleteFrom,
  loadFrom,
  postTo,
  roundTenths,
  useActivated,
  useInterval,
  useRefresh,
  When,
}
