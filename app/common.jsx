import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import React, { useCallback, useEffect, useRef, useState } from 'react'

import lib from './lib.jsx'


const Delete = ({ onClick }) => {
  const [isActive, setIsActive] = useState(false)

  return (
    <div className='delete flex-row'>
      <span onClick={() => setIsActive(on => !on)}>🗑️ </span>
      {isActive && <button className='delete' onClick={onClick}>Delete</button>}
    </div>
  )
}


// ⚡ 💨 🧮 🪨 ⏱️ 📍 🚲 🍔 📏  ️️💗️ 🫀️ 🩸 🍭 🫁 💪 🩺 🥛


const EXERCISE_METRICS = [
  { icon: '🧮', label: 'Reps', attr: 'reps' },
  { icon: '🪨', label: 'Resistance', attr: 'resistance_n', formats: { 'N': null, 'lbf': 0.2248, 'kgf': 0.102 } },
  { icon: '⏱️', label: 'Duration', attr: 'duration_s', formats: { '': [lib.formatDuration, lib.parseDuration] } },
  { icon: '📍', label: 'Distance', attr: 'distance_m', formats: { 'm': null, 'km': 0.001, 'mi': 0.0062137 } },
  { icon: '🚲', label: 'Cadence', attr: 'cadence_hz', formats: { 'Hz': null, 'rpm': 60 } },
  { icon: '🍔', label: 'Energy', attr: 'energy_kj', formats: { 'kJ': null, 'Wh': 0.2777778, 'kcal': 0.2388459 } },
  { icon: '⚡', label: 'Average Power', attr: 'average_power_w', formats: { 'W': null, 'kcal/min': 0.014330753797649757 } },
  { icon: '⚡', label: 'Peak Power', attr: 'peak_power_w', formats: { 'W': null, 'kcal/min': 0.014330753797649757 } },
]


const SNAPSHOT_METRICS = [
  { icon: '📏', label: 'Height', attr: 'height_cm', minimum: 50, maximum: 300, formats: { 'in': 0.3937, 'cm': null } },
  { icon: '⚖️',  label: 'Weight', attr: 'weight_kg', minimum: 1, maximum: 300, formats: { 'lb': 2.20462, 'st': 0.15747, 'kg': null } },
  { icon: '🌡️',  label: 'Body Temperature', attr: 'body_temp_degc', minimum: 20, maximum: 50, formats: { '°C': null, '°F': [degc => degc * 1.8 + 32, degf => (degf - 32) / 1.8] } },
  { icon: '🩸', label: 'Menstrual Flow', attr: 'menstrual_flow', isLikert: true, female: true },
  { icon: '😬', label: 'Pain', attr: 'pain', isLikert: true },
  { icon: '😠', label: 'Anger', attr: 'anger', isLikert: true  },
  { icon: '😨', label: 'Fear', attr: 'fear', isLikert: true  },
  { icon: '😄', label: 'Joy', attr: 'joy', isLikert: true  },
  { icon: '😢', label: 'Sadness', attr: 'sadness', isLikert: true  },
  { icon: '💗️', label: 'Heart Rate', attr: 'heart_rate_bpm', minimum: 10, maximum: 250, formats: { 'bpm': null, 'Hz': 1 / 60 } },
  { icon: '💨️', label: 'Respiration Rate', attr: 'respiration_rate_bpm', minimum: 1, maximum: 100, formats: { 'bpm': null, 'Hz': 1 / 60 } },
  { icon: '🫀️', label: 'Blood Pressure', attr: 'blood_pressure_kpa', formats: { 'kPa': null, 'mmHg': 7.50061683 } },
  { icon: '🫁', label: 'Blood Oxygen', attr: 'oxygen_spo2_pct', minimum: 80, maximum: 100, formats: { '%': null } },
  { icon: '🍭', label: 'Blood Glucose', attr: 'glucose_mmol_l', minimum: 30, maximum: 300, formats: { 'mmol/L': null } },
  { icon: '🥛', label: 'Blood Lactate', attr: 'lactate_mmol_l', minimum: 1, maximum: 30, formats: { 'mmol/L': null } },
  { icon: '💪', label: 'VO2 Max', attr: 'vo2_max_ml_kg_min', minimum: 10, maximum: 100, formats: { 'mL/(kg·min)': null } },
]


const Meter = ({ value, goal, icon, label, minimum, maximum, isLikert, formats, onChange, onLongPress, onClick }) => {
  const [editing, setEditing] = useState(false)

  if (!formats) formats = { '': null }

  const units = Object.keys(formats)
  const unitStorageKey = `oomph-unit-${label}`
  const [unit, setUnit] = useState(localStorage.getItem(unitStorageKey) ?? units[0])

  const format = x => (Math.abs(Math.round(x) - x) < 1e-5) ? Math.round(x) : lib.roundTenths(x)

  const convertToDisplay = v => {
    const f = formats[unit]
    if (Number.isFinite(f)) return format(v * f)
    if (f instanceof Array) return format(f[0](v))
    return format(v)
  }

  const convertFromDisplay = v => {
    const f = formats[unit]
    if (Number.isFinite(f)) return v / f
    if (f instanceof Array) return f[1](v)
    return v
  }

  const handlers = onLongPress ? useLongPress(onLongPress, onClick) : onClick ? { onClick: onClick } : {}
  const inputAttrs = { minimum: minimum || 0 }
  if (maximum) inputAttrs.maximum = maximum

  if (value === undefined || value === null) return null

  return (
    <div className='metric flex-row' title={label}>
      <span {...handlers}>{icon ?? ''}</span>
      {label ? <span className='label'>{label}</span> : null}
      {
        isLikert ? (
          <>
            <input type='range' min='1' max='10' step='1'
                   defaultValue={value || 1}
                   onChange={e => onChange(+e.target.value)} />
            <span className='value'>{value || 1}</span>
          </>
        ) : (
          <>
            <span className={`value ${onChange ? 'can-edit' : ''}`}
                  onClick={onChange ? () => setEditing(true) : null}>
              {
                (!editing && value)
                  ? convertToDisplay(value)
                  : <input type='number'
                           {...inputAttrs}
                           defaultValue={value ? convertToDisplay(value) : ''}
                           autoFocus
                           onFocus={e => e.target.select()}
                           onBlur={e => setEditing(false)}
                           onChange={e => {
                             setEditing(true)
                             onChange(+convertFromDisplay(e.target.value))
                           }} />
              }
            </span>
            <span className={`unit options-${units.length}`} onClick={() => setUnit(u => {
                    const i = units.indexOf(u)
                    const next = units[(i + 1) % units.length]
                    localStorage.setItem(unitStorageKey, next)
                    return next
                  })}>{unit}</span>
          </>
        )
      }
      {goal && <span className='goal'>(🎯 {convertToDisplay(goal)})</span>}
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
    doClick && !didLongPress && onClick && onClick()
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
  Delete,
  EXERCISE_METRICS,
  Meter,
  SNAPSHOT_METRICS,
  useLongPress,
}
