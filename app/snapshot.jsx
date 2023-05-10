import React, { useEffect, useState } from 'react'
import { useHistory, useParams } from 'react-router-dom'
import showdown from 'showdown'

import { apiRead, apiUpdate, apiDelete } from './api.jsx'
import { roundTenths, When } from './common.jsx'
import { Map } from './geo.jsx'

import './snapshot.styl'


const Snapshot = () => {
  useEffect(() => {
    showdown.setOption('simplifiedAutoLink', true)
    showdown.setOption('excludeTrailingPunctuationFromURLs', true)
    showdown.setOption('literalMidWordUnderscores', true)
    showdown.setOption('literalMidWordAsterisks', true)
  }, [])

  const id = useParams().id
  const history = useHistory()
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => { apiRead(`snapshot/${id}`).then(setSnapshot) }, [id])

  const update = data => apiUpdate(`snapshot/${id}`, data).then(setSnapshot)

  if (!snapshot) return null

  return <div className='snapshot'>
    <Map lat={snapshot.lat || 0}
         lng={snapshot.lng || 0}
         onChanged={([lat, lng]) => update({ lat, lng })} />
    <div className='container'>
      <When utc={snapshot.utc} tz={snapshot.tz} />
      <Vitals snapshot={snapshot} update={update} />
      <Text note={snapshot.note} update={update} />
      <button className='delete' onClick={() => {
        if (confirm('Really delete?')) {
          apiDelete(`snapshot/${id}`).then(() => history.push('/timeline/'))
        }
      }}>🗑️</button>
    </div>
  </div>
}


const Text = ({ note, update }) => {
  const [isEditing, setIsEditing] = useState(false)
  return isEditing
       ? <textarea onBlur={e => { setIsEditing(false); update({ note: e.target.value }) }}
                   defaultValue={note || 'Click to edit!'} />
       : <div className='rendered'
              onClick={() => setIsEditing(true)}
              dangerouslySetInnerHTML={{
                __html: new showdown.Converter().makeHtml(note || 'Click to edit!')
              }} />
}


const Vitals = ({ snapshot, update }) => <div className='vitals'>
  <div className='mood'>
    <span className='bar' onClick={e => {
      const { width } = e.target.getBoundingClientRect()
      const x = e.nativeEvent.offsetX
      update({ mood: Math.max(-1.0, Math.min(1.0, 2 * x / width - 1)) })
    }}></span>
    {snapshot.mood ? <span className='marker cur' style={{ left: `${Math.round(50 * (1 + snapshot.mood))}%` }}>📍</span> : null}
    <span className='marker lo'>😞</span>
    <span className='marker hi'>😊</span>
  </div>

  <div className='feels'>
    <Dial icon='😄' attr='happy' snapshot={snapshot} update={update} />
    <Dial icon='😢' attr='sad' snapshot={snapshot} update={update} />
    <Dial icon='😠' attr='angry' snapshot={snapshot} update={update} />
    <Dial icon='😨' attr='afraid' snapshot={snapshot} update={update} />
  </div>

  <Meter update={update} snapshot={snapshot} emoji='📏' label='Height'
         attr='height_cm' formats={{ in: 0.3937, cm: null }} />
  <Meter update={update} snapshot={snapshot} emoji='⚖️' label='Weight'
         attr='weight_kg' formats={{ lb: 2.20462, st: 0.15747, kg: null }} />
  <Meter update={update} snapshot={snapshot} emoji='🌡️' label='Temp'
         attr='body_temp_degc' formats={{ '°C': null, '°F': [
           degc => degc * 1.8 + 32, degf => (degf - 32) / 1.8 ] }} />
  <Meter update={update} snapshot={snapshot} emoji='💗️' label='Pulse'
         attr='heart_rate_bpm' formats={{ bpm: null, Hz: 1 / 60 }} />
  <Meter update={update} snapshot={snapshot} emoji='🫀️' label='Pressure'
         attr='blood_pressure_mmhg' formats={{ mmHg: null }} />
  <Meter update={update} snapshot={snapshot} emoji='🫁' label='Oxygen'
         attr='blood_oxygen_spo2_pct' formats={{ '%': null }} />
  <Meter update={update} snapshot={snapshot} emoji='🚴' label='V02 max'
         attr='vo2_max_ml_kg_min' formats={{ 'mL/(kg·min)': null }} />
  <Meter update={update} snapshot={snapshot} emoji='💪' label='Lactate'
         attr='lactate_mmol_l' formats={{ 'mmol/L': null }} />
  <Meter update={update} snapshot={snapshot} emoji='🍭' label='Glucose'
         attr='glucose_mmol_l' formats={{ 'mmol/L': null }} />
</div>


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

  return <div className='dial'>
    <span className={`arc level ${attr}`} style={{ clipPath: `polygon(${points.join(', ')})` }}></span>
    <span className='arc range' onClick={handle}></span>
    <span className='icon'>{icon}</span>
    <span className='value'>{Math.round(100 * value)}%</span>
    <span className='label'>{attr.charAt(0).toUpperCase() + attr.slice(1)}</span>
  </div>
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

  return <div className='meter'>
    {!emoji ? null : <span className='emoji'>{emoji}</span>}
    <span className='label'>{label || attr}</span>
    <span className={`value ${update ? 'can-edit' : ''}`}
          onClick={update ? () => setEditing(true) : null}>{
            !editing ? !storedValue ? '---' : roundTenths(displayedValue)
                     : <input type='text' defaultValue={displayedValue} autoFocus
                              onFocus={e => e.target.select()} onBlur={e => {
                                setEditing(false)
                                update({ [attr]: convertFromDisplay(e.target.value) })
                              } } />
    }</span>
    <span className={`unit options-${units.length}`} onClick={() => setUnit(u => {
      const i = units.indexOf(u)
      const next = units[(i + 1) % units.length]
      localStorage.setItem(unitStorageKey, next)
      return next
    })}>{unit}</span>
  </div>
}


export { Snapshot }
