import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import showdown from 'showdown'

showdown.setOption('simplifiedAutoLink', true)
showdown.setOption('excludeTrailingPunctuationFromURLs', true)
showdown.setOption('literalMidWordUnderscores', true)
showdown.setOption('literalMidWordAsterisks', true)

import { Dial, Meter, METRICS } from './common.jsx'
import { Map, useGeo } from './geo.jsx'
import lib from './lib.jsx'

import './snapshot.styl'


export default () => {
  const id = +useParams().id
  const navigate = useNavigate()
  const snapshots = useLiveQuery(() => db.snapshots.where({ id }).toArray(), [id])
  if (!snapshots) return null
  const snapshot = snapshots[0]
  if (!snapshot) return navigate('/')
  const when = dayjs.unix(snapshot.utc).tz(snapshot.tz)

  const update = attr => value => db.snapshots.update(snapshot.id, { [attr]: value })

  return (
    <div key={id} className='snapshot'>
      <div className='when'><span className='emoji'>🕰️</span><span>{when.format('llll')}</span></div>

      {!snapshot.lat || !snapshot.lng ? null :
       <Map lat={snapshot.lat}
            lng={snapshot.lng}
            onChange={([lat, lng]) => db.snapshots.update(snapshot.id, { lat, lng })} />}

      <Mood value={snapshot.mood} update={update('mood')} />

      <div className='feels'>
        <span className='emoji'></span>
        <Dial icon='😄' label='Joy' value={snapshot.joy} update={update('joy')} />
        <Dial icon='😠' label='Anger' value={snapshot.anger} update={update('anger')} />
        <Dial icon='😨' label='Fear' value={snapshot.fear} update={update('fear')} />
        <Dial icon='😢' label='Sadness' value={snapshot.sadness} update={update('sadness')} />
      </div>

      {METRICS.vitals.map(
        m => m.attr in snapshot
          ? <Meter key={m.attr}
                   onChange={update(m.attr)}
                   onEmojiLongPress={() => update(m.attr)(null)}
                   value={snapshot[m.attr]}
                   {...m} />
          : null)}

      <div className='available'>
        {METRICS.vitals.map(
          m => snapshot[m.attr]
            ? null
            : <span key={m.attr}
                    className={m.attr}
                    title={m.label}
                    onClick={() => update(m.attr)(0)}
              >{m.emoji}</span>)}
      </div>

      <Text value={snapshot.note || ''} update={update('note')} />

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


const Delete = ({ snapshot }) => {
  const id = +useParams().id
  const [isActive, setIsActive] = useState(false)
  const navigate = useNavigate()

  onClick = async () => {
    await db.snapshots.delete(id)
    navigate(-1)
  }

  return (
    <div className='delete'>
      <span className='emoji' onClick={() => setIsActive(on => !on)}>🗑️ </span>
      {isActive
       ? <button className='delete' onClick={onClick}>Delete</button>
       : null}
    </div>
  )
}
