import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))

import React, { useEffect, useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router-dom'
import showdown from 'showdown'

import { apiRead, apiUpdate, apiDelete } from './api.jsx'
import { Dial, Meter, Mood } from './common.jsx'
import { Map, useGeo } from './geo.jsx'
import lib from './lib.jsx'

import './snapshot.styl'


const Snapshot = () => {
  useEffect(() => {
    showdown.setOption('simplifiedAutoLink', true)
    showdown.setOption('excludeTrailingPunctuationFromURLs', true)
    showdown.setOption('literalMidWordUnderscores', true)
    showdown.setOption('literalMidWordAsterisks', true)
  }, [])

  const navigate = useNavigate()
  const snapshot = useLoaderData()
  const [fields, setFields] = useState(snapshot.kv)

  const updateNote = note => apiUpdate(`snapshot/${snapshot.id}`, { note })
  const updateLatLng = ([lat, lng]) => apiUpdate(`snapshot/${snapshot.id}`, { lat, lng })
  const updateField = attr => value => (
    apiUpdate(`snapshot/${snapshot.id}`, { [attr]: value }).then(res => setFields(res.kv)))

  const when = dayjs.unix(snapshot.utc).tz(snapshot.tz)

  return (
    <div className='snapshot container'>
      <div className='when'>
        {['H:mm a', 'dddd', 'M', 'MMMM', 'D', 'YYYY'].map(
          fmt => <span className={fmt.replace(/\W+/g, '-')}>{when.format(fmt)}</span>
        )}
      </div>

      {snapshot.lat && snapshot.lng
       ? <Map lat={snapshot.lat} lng={snapshot.lng} onChanged={value => updateLatLng(value)} />
       : <button onClick={() => useGeo().then(
                   geo => updateLatLng([geo.coords.latitude, geo.coords.longitude])
                 )}>📍️</button>}


      <div>
        <h2>Mood</h2>
        <Mood value={fields.mood} update={updateField('mood')} />
        <div className='feels'>
          <Dial icon='😄' label='Joy' value={fields.joy} update={updateField('joy')} />
          <Dial icon='😢' label='Sadness' value={fields.sadness} update={updateField('sadness')} />
          <Dial icon='😠' label='Anger' value={fields.anger} update={updateField('anger')} />
          <Dial icon='😨' label='Fear' value={fields.fear} update={updateField('fear')} />
        </div>
      </div>

      <Meter update={updateField('height_cm')} value={fields.height_cm}
             emoji='📏' label='Height' formats={{ 'in': 0.3937, 'cm': null }} />
      <Meter update={updateField('weight_kg')} value={fields.weight_kg}
             emoji='⚖️' label='Weight' formats={{ 'lb': 2.20462, 'st': 0.15747, 'kg': null }} />
      <Meter update={updateField('body_temp_degc')} value={fields.body_temp_degc}
             emoji='🌡️' label='Temp' formats={{ '°C': null, '°F': [
               degc => degc * 1.8 + 32, degf => (degf - 32) / 1.8 ] }} />
      <Meter update={updateField('heart_rate_bpm')} value={fields.heart_rate_bpm}
             emoji='💗️' label='Pulse' formats={{ 'bpm': null, 'Hz': 1 / 60 }} />
      <Meter update={updateField('blood_pressure_mmhg')} value={fields.blood_pressure_mmhg}
             emoji='🫀️' label='Blood Pressure' formats={{ 'mmHg': null }} />
      <Meter update={updateField('blood_oxygen_spo2_pct')} value={fields.blood_oxygen_spo2_pct}
             emoji='🩸' label='Blood Oxygen' formats={{ '%': null }} />
      <Meter update={updateField('vo2_max_ml_kg_min')} value={fields.vo2_max_ml_kg_min}
             emoji='🫁' label='VO2 max' formats={{ 'mL/(kg·min)': null }} />
      <Meter update={updateField('lactate_mmol_l')} value={fields.lactate_mmol_l}
             emoji='💪' label='Lactate' formats={{ 'mmol/L': null }} />
      <Meter update={updateField('glucose_mmol_l')} value={fields.glucose_mmol_l}
             emoji='🍭' label='Glucose' formats={{ 'mmol/L': null }} />

      <div className='note'>
        <h2>Note</h2>
        <Text value={snapshot.note || ''} update={value => updateNote(value)} />
      </div>

      <button className='delete' onClick={() => {
                if (confirm('Really delete?')) {
                  apiDelete(`snapshot/${snapshot.id}`).then(() => navigate(-1))
                }
              }}>🗑️ Delete</button>
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


export { Snapshot }
