import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import React, { useEffect, useRef, useState } from 'react'

import lib from './lib.jsx'


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


const Dial = ({ icon, attr, snapshot, update }) => {
  const value = Math.max(0, snapshot[attr] || 0)

  const levels = 20
  const range = 1.3333 * Math.PI
  const offset = (Math.PI + range) / 2
  const level2angle = lev => offset - lev / levels * range
  const angle2level = ang => Math.round((offset - ang) % (2 * Math.PI) / range * levels)

  const angles = [...Array(1 + Math.max(0, Math.round(levels * value))).keys()].map(l => level2angle(l))
  const points = [
    ...angles.map(a => `${50 + 50 * Math.cos(a)}% ${50 - 50 * Math.sin(a)}%`),
    ...angles.map(a => `${50 + 35 * Math.cos(a)}% ${50 - 35 * Math.sin(a)}%`).reverse(),
  ]

  const handle = e => {
    const { width, height } = e.target.getBoundingClientRect()
    const x = e.nativeEvent.offsetX, y = e.nativeEvent.offsetY
    const angle = Math.atan2(1 - 2 * y / height, 2 * x / width - 1)
    const level = angle2level(angle)
    update({ [attr]: Math.max(0.0, Math.min(1.0, level / levels)) })
  }

  return (
    <div className='dial'>
      <span className={`arc level ${attr}`} style={{ clipPath: `polygon(${points.join(', ')})` }}></span>
      <span className='arc range' onClick={handle}></span>
      <span className='icon'>{icon}</span>
      <span className='value'>{Math.round(100 * value)}%</span>
      <span className='label'>{attr.charAt(0).toUpperCase() + attr.slice(1)}</span>
    </div>
  )
}


const Meter = ({ snapshot, attr, label, emoji, formats, update }) => {
  const [editing, setEditing] = useState(false)

  if (!formats) formats = { '': null }

  const value = snapshot[attr]
  const units = Object.keys(formats)
  const unitStorageKey = `omphalos-unit-${attr}`
  const [unit, setUnit] = useState(localStorage.getItem(unitStorageKey))

  useEffect(() => {
    if (units.indexOf(unit) < 0) setUnit(units.find(u => formats[u] === null))
  }, [unit, units])

  const convertToDisplay = v => {
    const factor = formats[unit]
    return !factor ? v : factor.length ? factor[0](v) : v * factor
  }

  const convertFromDisplay = v => {
    const factor = formats[unit]
    return !factor ? v : factor.length ? factor[1](v) : v / factor
  }

  const storedValue = value
  const displayedValue = convertToDisplay(storedValue)

  return (
    <div className='meter'>
      {!emoji ? null : <span className='emoji'>{emoji}</span>}
      <span className='label'>{label || attr}</span>
      <span className={`value ${update ? 'can-edit' : ''}`}
            onClick={update ? () => setEditing(true) : null}>{
              !editing ? !storedValue ? '---' : lib.roundTenths(displayedValue)
              : <input type='text' defaultValue={displayedValue} autoFocus
                       onFocus={e => e.target.select()} onBlur={e => {
                         setEditing(false)
                         update({ [attr]: convertFromDisplay(e.target.value) })
                       }} />
            }</span>
      <span className={`unit options-${units.length}`} onClick={() => setUnit(u => {
              const i = units.indexOf(u)
              const next = units[(i + 1) % units.length]
              localStorage.setItem(unitStorageKey, next)
              return next
            })}>{unit}</span>
    </div>
  )
}


const When = ({ utc, tz }) => {
  const t = dayjs.unix(utc).tz(tz)
  return (
    <div className='when'>
      <span className='year'>{t.format('YYYY')}</span>
      <span className='month'>{t.format('MMMM')}</span>
      <span className='day'>{t.format('D')}</span>
      <span className='weekday'>({t.format('dddd')})</span>
      <span className='time'>{t.format('h:mm a')}</span>
    </div>
  )
}


export {
  Dial,
  Meter,
  useActivated,
  useInterval,
  useRefresh,
  When,
}
