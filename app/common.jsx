import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import React, { useCallback, useEffect, useRef, useState } from 'react'

import lib from './lib.jsx'


const Dial = ({ icon, label, value, update }) => {
  value = value ?? 0

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
    update(Math.max(0.0, Math.min(1.0, level / levels)))
  }

  return (
    <div className='dial'>
      <span className={`arc level ${label.toLowerCase()}`}
            style={{ clipPath: `polygon(${points.join(', ')})` }}></span>
      <span className='arc range' onClick={handle}></span>
      <span className='icon'>{icon}</span>
      <span className='value'>{Math.round(100 * value)}%</span>
      <span className='label'>{label}</span>
    </div>
  )
}


const Meter = ({ value, label, emoji, formats, update }) => {
  const [editing, setEditing] = useState(false)

  if (!formats) formats = { '': null }

  const units = Object.keys(formats)
  const unitStorageKey = `omphalos-unit-${units.join('_')}`
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
    <div className={`meter ${(value === null || value === undefined) ? 'null' : ''}`} title={label}>
      {!emoji ? null : <span className='emoji'>{emoji}</span>}
      <span className='label'>{label}</span>
      <span className={`value ${update ? 'can-edit' : ''}`}
            onClick={update ? () => setEditing(true) : null}>
        {editing ? <input type='text'
                          defaultValue={displayedValue}
                          autoFocus
                          onFocus={e => e.target.select()}
                          onBlur={e => {
                            setEditing(false)
                            update(+convertFromDisplay(e.target.value))
                          }} /> :
         storedValue ? lib.roundTenths(displayedValue) : '---'}
      </span>
      <span className={`unit options-${units.length}`} onClick={() => setUnit(u => {
              const i = units.indexOf(u)
              const next = units[(i + 1) % units.length]
              localStorage.setItem(unitStorageKey, next)
              return next
            })}>{unit}</span>
    </div>
  )
}


// https://stackoverflow.com/q/48048957
const useLongPress = (onLongPress, onClick, { preventDefault = true, delay = 700 } = {}) => {
  const [longPressed, setLongPressed] = useState(false)
  const timeout = useRef()
  const target = useRef()

  const doPreventDefault = event => (
      ('touches' in event) &&
      (event.touches.length < 2) &&
      (event.preventDefault)) ? event.preventDefault() : null

  const start = useCallback(event => {
    if (event.button !== 0) return
    if (preventDefault && event.target) {
      event.target.addEventListener('touchend', doPreventDefault, { passive: false })
      target.current = event.target
    }
    timeout.current = setTimeout(() => { onLongPress(event); setLongPressed(true) }, delay)
  }, [onLongPress, delay, preventDefault])

  const clear = useCallback((event, doClick) => {
    timeout.current && clearTimeout(timeout.current)
    doClick && !longPressed && onClick()
    setLongPressed(false)
    if (preventDefault && target.current) {
      target.current.removeEventListener('touchend', doPreventDefault)
    }
  }, [preventDefault, onClick, longPressed])

  return {
    onMouseDown: e => start(e),
    onTouchStart: e => start(e),
    onMouseUp: e => clear(e, true),
    onMouseLeave: e => clear(e, false),
    onTouchEnd: e => clear(e, true),
  }
}


export {
  Dial,
  Meter,
  useLongPress,
}
