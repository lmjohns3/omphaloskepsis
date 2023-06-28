import React, { useEffect, useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router-dom'
import showdown from 'showdown'

import { apiRead, apiUpdate, apiDelete } from './api.jsx'
import { Dial, Meter, When } from './common.jsx'
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
  const [snapshot, setSnapshot] = useState(useLoaderData())

  const update = data => apiUpdate(`snapshot/${snapshot.id}`, data).then(setSnapshot)

  return snapshot ? (
    <div className='snapshot'>
      <Map lat={snapshot.lat || 0}
           lng={snapshot.lng || 0}
           onChanged={([lat, lng]) => update({ lat, lng })} />
      <div className='container'>
        <When utc={snapshot.utc} tz={snapshot.tz} />
        <Vitals snapshot={snapshot} update={update} />
        <Text value={snapshot.note} update={v => update({ note: v })} />
        <button className='delete' onClick={() => {
                  if (confirm('Really delete?')) {
                    apiDelete(`snapshot/${snapshot.id}`).then(() => navigate(-1))
                  }
                }}>🗑️</button>
      </div>
    </div>
  ) : null
}


const Text = ({ value, update }) => {
  const [isEditing, setIsEditing] = useState(false)
  return isEditing ? (
    <textarea defaultValue={value || 'Click to edit!'}
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
      <Dial icon='😄' attr='joy' value={snapshot.joy} update={update} />
      <Dial icon='😢' attr='sadness' value={snapshot.sadness} update={update} />
      <Dial icon='😠' attr='anger' value={snapshot.anger} update={update} />
      <Dial icon='😨' attr='fear' value={snapshot.fear} update={update} />
    </div>

    <Meter update={update} value={snapshot.height_cm} emoji='📏' label='Height'
           attr='height_cm' formats={{ 'in': 0.3937, 'cm': null }} />
    <Meter update={update} value={snapshot.weight_kg} emoji='⚖️' label='Weight'
           attr='weight_kg' formats={{ 'lb': 2.20462, 'st': 0.15747, 'kg': null }} />
    <Meter update={update} value={snapshot.body_temp_degc} emoji='🌡️' label='Temp'
           attr='body_temp_degc' formats={{ '°C': null, '°F': [
             degc => degc * 1.8 + 32, degf => (degf - 32) / 1.8 ] }} />
    <Meter update={update} value={snapshot.heart_rate_bpm} emoji='💗️' label='Pulse'
           attr='heart_rate_bpm' formats={{ 'bpm': null, 'Hz': 1 / 60 }} />
    <Meter update={update} value={snapshot.blood_pressure_mmhg} emoji='🫀️' label='Pressure'
           attr='blood_pressure_mmhg' formats={{ 'mmHg': null }} />
    <Meter update={update} value={snapshot.blood_oxygen_spo2_pct} emoji='🩸' label='Oxygen'
           attr='blood_oxygen_spo2_pct' formats={{ '%': null }} />
    <Meter update={update} value={snapshot.vo2_max_ml_kg_min} emoji='🫁' label='V02 max'
           attr='vo2_max_ml_kg_min' formats={{ 'mL/(kg·min)': null }} />
    <Meter update={update} value={snapshot.lactate_mmol_l} emoji='💪' label='Lactate'
           attr='lactate_mmol_l' formats={{ 'mmol/L': null }} />
    <Meter update={update} value={snapshot.glucose_mmol_l} emoji='🍭' label='Glucose'
           attr='glucose_mmol_l' formats={{ 'mmol/L': null }} />
  </div>
)


export { Snapshot }
