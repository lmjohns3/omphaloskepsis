import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import React, { useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router-dom'
import showdown from 'showdown'

showdown.setOption('simplifiedAutoLink', true)
showdown.setOption('excludeTrailingPunctuationFromURLs', true)
showdown.setOption('literalMidWordUnderscores', true)
showdown.setOption('literalMidWordAsterisks', true)

import { apiUpdate, apiDelete } from './api.jsx'
import { Dial, Meter } from './common.jsx'
import { Map, useGeo } from './geo.jsx'
import lib from './lib.jsx'

import './snapshot.styl'


const Snapshot = () => {
  const navigate = useNavigate()
  const snapshot = useLoaderData()
  const [fields, setFields] = useState(snapshot.kv)

  const updateNote = note => apiUpdate(`snapshot/${snapshot.id}`, { note })
  const updateLatLng = ([lat, lng]) => apiUpdate(`snapshot/${snapshot.id}`, { lat, lng })
  const updateField = attr => value => (
    apiUpdate(`snapshot/${snapshot.id}`, { [attr]: value }).then(res => setFields(res.kv)))

  const when = dayjs.unix(snapshot.utc).tz(snapshot.tz)

  return (
    <div className='snapshot'>
      <span className='tab'>🕰️</span><p className='when'>{when.format('llll')}</p>

      <span className='tab'>🗺️️ </span>
      {snapshot.lat && snapshot.lng
       ? <Map lat={snapshot.lat} lng={snapshot.lng} onChanged={value => updateLatLng(value)} />
       : <button onClick={() => useGeo().then(geo => updateLatLng([geo.coords.latitude, geo.coords.longitude]))}>📍️ Map</button>}

      <span className='tab' style={{ alignSelf: 'center' }}>🧐</span>
      <Mood value={fields.mood} update={updateField('mood')} />

      <div className='feels'>
        <Dial icon='😄' label='Joy' value={fields.joy} update={updateField('joy')} />
        <Dial icon='😢' label='Sadness' value={fields.sadness} update={updateField('sadness')} />
        <Dial icon='😠' label='Anger' value={fields.anger} update={updateField('anger')} />
        <Dial icon='😨' label='Fear' value={fields.fear} update={updateField('fear')} />
      </div>

      <span className='tab'>📏</span>
      <Meter update={updateField('height_cm')} value={fields.height_cm} formats={{ 'in': 0.3937, 'cm': null }} />
      <span className='tab'>⚖️</span>
      <Meter update={updateField('weight_kg')} value={fields.weight_kg} formats={{ 'lb': 2.20462, 'st': 0.15747, 'kg': null }} />
      <span className='tab'>🌡️</span>
      <Meter update={updateField('body_temp_degc')} value={fields.body_temp_degc}
             formats={{ '°C': null, '°F': [degc => degc * 1.8 + 32, degf => (degf - 32) / 1.8] }} />
      <span className='tab'>💗️</span>
      <Meter update={updateField('heart_rate_bpm')} value={fields.heart_rate_bpm} formats={{ 'bpm': null, 'Hz': 1 / 60 }} />
      <span className='tab'>🫀️</span>
      <Meter update={updateField('blood_pressure_mmhg')} value={fields.blood_pressure_mmhg} formats={{ 'mmHg': null }} />
      <span className='tab'>🩸</span>
      <Meter update={updateField('blood_oxygen_spo2_pct')} value={fields.blood_oxygen_spo2_pct} formats={{ '%': null }} />
      <span className='tab'>🫁</span>
      <Meter update={updateField('vo2_max_ml_kg_min')} value={fields.vo2_max_ml_kg_min} formats={{ 'mL/(kg·min)': null }} />
      <span className='tab'>💪</span>
      <Meter update={updateField('lactate_mmol_l')} value={fields.lactate_mmol_l} formats={{ 'mmol/L': null }} />
      <span className='tab'>🍭</span>
      <Meter update={updateField('glucose_mmol_l')} value={fields.glucose_mmol_l} formats={{ 'mmol/L': null }} />

      <span className='tab'>📝</span>
      <Text value={snapshot.note || ''} update={updateNote} />

      <span className='tab'>🗑️ </span>
      <span><button className='delete'
                    onClick={() => {
                      if (confirm('Really delete?'))
                        apiDelete(`snapshot/${snapshot.id}`).then(() => navigate(-1))
                    }}>Delete</button></span>
      </div>
  )
}


const Text = ({ value, update }) => {
  const [isEditing, setIsEditing] = useState(false)
  return isEditing ? (
    <textarea autoFocus defaultValue={value}
              onBlur={e => { setIsEditing(false); update(e.target.value) }} />
  ) : (
    <div className='rendered'
         onClick={() => setIsEditing(true)}
         dangerouslySetInnerHTML={{
           __html: new showdown.Converter().makeHtml(value || 'Click to edit!')
         }} />
  )
}


const Mood = ({ value, update }) => {
  const frac = (1 + (value ?? 0)) / 2
  const faces = ['😞️', '🙁', '😐', '🙂', '😊']
  return (
    <div className='mood' onClick={e => {
           const { width } = e.target.getBoundingClientRect()
           if (width < 100) return
           const x = e.nativeEvent.offsetX
           update(Math.max(-1, Math.min(1, 2 * x / width - 1)))
         }}>
      <span className='marker' style={{ left: `${Math.round(100 * frac)}%` }}>
        {faces[Math.round(frac * (faces.length - 1))]}
      </span>
    </div>
  )
}


export { Snapshot }
