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


const METRICS = {
  exercise: [
    { emoji: '🧮', label: 'Reps', attr: 'reps' },
    { emoji: '🪨', label: 'Resistance', attr: 'resistance_n', formats: { N: null, lb: 0.2248, kg: 0.102 } },
    { emoji: '⏱️', label: 'Duration', attr: 'duration_s', formats: { '': [lib.formatDuration, lib.parseDuration] } },
    { emoji: '📍', label: 'Distance', attr: 'distance_m', formats: { m: null, km: 0.001, mi: 0.0062137 } },
    { emoji: '🚲', label: 'Cadence', attr: 'cadence_hz', formats: { Hz: null, rpm: 60 } },
    { emoji: '⚡', label: 'Average Power', attr: 'avg_power_w', formats: { W: null, hp: 0.00134102 } },
  ],
  vitals: [
    { emoji: '📏', label: 'Height', attr: 'height_cm', formats: { 'in': 0.3937, 'cm': null } },
    { emoji: '⚖️',  label: 'Weight', attr: 'weight_kg', formats: { 'lb': 2.20462, 'st': 0.15747, 'kg': null } },
    { emoji: '🌡️',  label: 'Body Temperature', attr: 'body_temp_degc', formats: {
      '°C': null, '°F': [degc => degc * 1.8 + 32, degf => (degf - 32) / 1.8] } },
    { emoji: '💗️', label: 'Heart Rate', attr: 'heart_rate_bpm', formats: { 'bpm': null, 'Hz': 1 / 60 } },
    { emoji: '🫀️', label: 'Blood Pressure', attr: 'blood_pressure_mmhg', formats: { 'mmHg': null } },
    { emoji: '🩸', label: 'Blood Oxygen', attr: 'oxygen_spo2_pct', formats: { '%': null } },
    { emoji: '🍭', label: 'Glucose', attr: 'glucose_mmol_l', formats: { 'mmol/L': null } },
    { emoji: '🫁', label: 'VO2 Max', attr: 'vo2_max_ml_kg_min', formats: { 'mL/(kg·min)': null } },
    { emoji: '💪', label: 'Lactate', attr: 'lactate_mmol_l', formats: { 'mmol/L': null } },
  ],
}


const Meter = ({ value, label, emoji, formats, onChange }) => {
  const [editing, setEditing] = useState(onChange && !value)

  if (!formats) formats = { '': null }

  const units = Object.keys(formats)
  const unitStorageKey = `omphalos-unit-${label}`
  const [unit, setUnit] = useState(localStorage.getItem(unitStorageKey) ?? units[0])

  const convertToDisplay = v => {
    const f = formats[unit]
    if (Number.isFinite(f)) return v * f
    if (f instanceof Array) return f[0](v)
    return v
  }

  const convertFromDisplay = v => {
    const f = formats[unit]
    if (Number.isFinite(f)) return v / f
    if (f instanceof Array) return f[1](v)
    return v
  }

  const displayed = convertToDisplay(value)

  return (value === null || value === undefined) ? null : (
    <div className='meter' title={label}>
      <span className='emoji'>{emoji ?? ''}</span>
      {label ? <span className='label'>{label}</span> : null}
      <span className={`value ${onChange ? 'can-edit' : ''}`}
            onClick={onChange ? () => setEditing(true) : null}>
        {editing ? <input type='text'
                          defaultValue={displayed}
                          autoFocus
                          onFocus={e => e.target.select()}
                          onBlur={e => {
                            setEditing(false)
                            onChange(+convertFromDisplay(e.target.value))
                          }} /> :
         Math.round(displayed) === displayed ? Math.round(displayed) :
         lib.roundTenths(displayed)}
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
  const [didLongPress, setDidLongPress] = useState(false)
  const timeout = useRef()
  const target = useRef()

  const doPreventDefault = event => (
      ('touches' in event) &&
      (event.touches.length < 2) &&
      (event.preventDefault)) ? event.preventDefault() : null

  const start = useCallback(event => {
    if (event.button > 0) return
    if (preventDefault && event.target) {
      event.target.addEventListener('touchend', doPreventDefault, { passive: false })
      target.current = event.target
    }
    timeout.current = setTimeout(() => { onLongPress(event); setDidLongPress(true) }, delay)
  }, [onLongPress, delay, preventDefault])

  const clear = useCallback((event, doClick) => {
    timeout.current && clearTimeout(timeout.current)
    doClick && !didLongPress && onClick()
    setDidLongPress(false)
    if (preventDefault && target.current) {
      target.current.removeEventListener('touchend', doPreventDefault)
    }
  }, [preventDefault, onClick, didLongPress])

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
  METRICS,
  useLongPress,
}
