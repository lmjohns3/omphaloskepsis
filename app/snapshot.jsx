import React, { useEffect, useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router-dom'
import showdown from 'showdown'

import { apiRead, apiUpdate, apiDelete } from './api.jsx'
import { Dial, Meter, Mood } from './common.jsx'
import { Map } from './geo.jsx'
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

  const updateField = attr => value => (
    apiUpdate(`snapshot/${snapshot.id}`, { [attr]: value })
      .then(res => setFields(res.kv)))

  return (
    <div className='snapshot container'>
      <Mood value={fields.mood} update={updateField('mood')} />

      <div className='feels'>
        <Dial icon='😄' attr='joy' value={fields.joy} update={updateField('joy')} />
        <Dial icon='😢' attr='sadness' value={fields.sadness} update={updateField('sadness')} />
        <Dial icon='😠' attr='anger' value={fields.anger} update={updateField('anger')} />
        <Dial icon='😨' attr='fear' value={fields.fear} update={updateField('fear')} />
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
      <Text value={snapshot.note || ''} update={value => update({ note: value })} />
      <button className='delete' onClick={() => {
                if (confirm('Really delete?')) {
                  apiDelete(`snapshot/${snapshot.id}`).then(() => navigate('/'))
                }
              }}>🗑️</button>
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


const Vitals = ({ snapshot, update }) => (
  <div className='vitals'>
  </div>
)


export { Snapshot }
