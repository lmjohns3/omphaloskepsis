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
import { Dial, Meter, METRICS } from './common.jsx'
import { Map, useGeo } from './geo.jsx'
import lib from './lib.jsx'

import './snapshot.styl'


const Snapshot = () => {
  const snapshot = useLoaderData()
  const [fields, setFields] = useState(snapshot.kv)

  const updateNote = note => apiUpdate(`snapshot/${snapshot.id}`, { note })
  const updateLatLng = ([lat, lng]) => apiUpdate(`snapshot/${snapshot.id}`, { lat, lng })
  const updateField = attr => value => (
    apiUpdate(`snapshot/${snapshot.id}`, { [attr]: value }).then(res => setFields(res.kv)))

  console.log(fields)

  const when = dayjs.unix(snapshot.utc).tz(snapshot.tz)

  return (
    <div key={snapshot.id} className='snapshot'>
      <div className='when'><span className='emoji'>🕰️</span><span>{when.format('llll')}</span></div>

      <Map lat={snapshot.lat} lng={snapshot.lng} onChanged={value => updateLatLng(value)} />

      <Mood value={fields.mood} update={updateField('mood')} />

      <div className='feels'>
        <span className='emoji'></span>
        <Dial icon='😄' label='Joy' value={fields.joy} update={updateField('joy')} />
        <Dial icon='😢' label='Sadness' value={fields.sadness} update={updateField('sadness')} />
        <Dial icon='😠' label='Anger' value={fields.anger} update={updateField('anger')} />
        <Dial icon='😨' label='Fear' value={fields.fear} update={updateField('fear')} />
      </div>

      {METRICS.vitals.map(
        meter => meter.attr in fields
          ? <Meter key={meter.attr}
                   onChange={updateField(meter.attr)}
                   value={fields[meter.attr]}
                   {...meter} />
          : null)}

      <div className='available'>
        {METRICS.vitals.map(
          meter => meter.attr in fields
            ? null
            : <span key={meter.attr}
                    className={meter.attr}
                    title={meter.label}
                    onClick={() => setFields(kv => ({ [meter.attr]: 0, ...kv }))}
              >{meter.emoji}</span>)}
      </div>

      <Text value={snapshot.note || ''} update={updateNote} />

      <Delete snapshot={snapshot} />
    </div>
  )
}


const Text = ({ value, update }) => {
  const [isEditing, setIsEditing] = useState(false)
  return (
    <div className='note'>
      <span className='emoji'>📝</span>
      {isEditing ? (
        <textarea autoFocus defaultValue={value}
                  onBlur={e => { setIsEditing(false); update(e.target.value) }} />
      ) : (
        <div className='rendered'
             onClick={() => setIsEditing(true)}
             dangerouslySetInnerHTML={{
               __html: new showdown.Converter().makeHtml(value || 'Click to edit!')
             }} />
      )}
    </div>
  )
}


const Mood = ({ value, update }) => {
  const frac = (1 + (value ?? 0)) / 2
  const faces = ['😞️', '🙁', '😐', '🙂', '😊']
  return (
    <div className='mood'>
      <span className='emoji' style={{ alignSelf: 'center' }}>🧐</span>
      <div className='bar' onClick={e => {
              const { width } = e.target.getBoundingClientRect()
              if (width < 100) return
              const x = e.nativeEvent.offsetX
              update(Math.max(-1, Math.min(1, 2 * x / width - 1)))
            }}>
        <span className='marker' style={{ left: `${Math.round(100 * frac)}%` }}>
          {faces[Math.round(frac * (faces.length - 1))]}
        </span>
      </div>
    </div>
  )
}


const Delete = () => {
  const [isActive, setIsActive] = useState(false)
  const navigate = useNavigate()

  return (
    <div className='delete'>
      <span className='emoji' onClick={() => setIsActive(on => !on)}>🗑️ </span>
      {isActive
       ? <button className='delete'
                 onClick={() => apiDelete(`snapshot/${snapshot.id}`)
                          .then(() => navigate(-1))}>Delete</button>
       : null}
    </div>
  )
}


export { Snapshot }
