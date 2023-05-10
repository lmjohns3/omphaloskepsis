import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import React, { useEffect, useRef, useState } from 'react'

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

const When = ({ utc, tz }) => {
  const t = dayjs.unix(utc).tz(tz)
  return <div className='when'>
    <span className='year'>{t.format('YYYY')}</span>
    <span className='month'>{t.format('MMMM')}</span>
    <span className='day'>{t.format('D')}</span>
    <span className='weekday'>({t.format('dddd')})</span>
    <span className='time'>{t.format('h:mm a')}</span>
  </div>
}

const roundTenths = x => x.toLocaleString(
  undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export {
  roundTenths,
  useActivated,
  useInterval,
  useRefresh,
  When,
}
