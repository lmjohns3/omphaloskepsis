import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import { useLiveQuery } from 'dexie-react-hooks'
import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import showdown from 'showdown'

showdown.setOption('simplifiedAutoLink', true)
showdown.setOption('excludeTrailingPunctuationFromURLs', true)
showdown.setOption('literalMidWordUnderscores', true)
showdown.setOption('literalMidWordAsterisks', true)

import { Delete, Meter, SNAPSHOT_METRICS } from './common.jsx'
import { db } from './db.jsx'
import { Map, useGeo } from './geo.jsx'
import lib from './lib.jsx'

import './snapshot.styl'


export default () => {
  const id = +useParams().id
  const navigate = useNavigate()
  const snapshots_ = useLiveQuery(() => db.snapshots.where({ id }).toArray(), [id])
  const habits_ = useLiveQuery(() => db.habits.toArray())
  if (!habits_ || !snapshots_) return null
  const snapshot = snapshots_[0]
  const habits = habits_.sort((a, b) => a.name.localeCompare(b.name))
  if (!snapshot) return navigate('/')

  const addHabit = id => db.snapshots.update(snapshot.id, { habitIds: [ ...snapshot.habitIds, id ] })
  const removeHabit = id => db.snapshots.update(snapshot.id, { habitIds: [ ...snapshot.habitIds.filter(i => i !== id) ] })
  const update = attr => value => db.snapshots.update(snapshot.id, { [`metrics.${attr}`]: value })

  return (
    <div key={id} className='snapshot container'>
      <div className='when flex-row'>
        <span className='spacer'>🕰️</span>
        <span>{dayjs.unix(snapshot.utc).tz(snapshot.tz).format('llll')}</span>
      </div>

      <Map lat={snapshot.lat} lng={snapshot.lng} onChange={([lat, lng]) => db.snapshots.update(snapshot.id, { lat, lng })} />

      <div className='metrics'>
        <div className='flex-row'>
          <span className='spacer'></span>
          <select value='' onChange={e => update(e.target.value)('')}>
            <option disabled value=''>Add a metric...</option>
            {
              SNAPSHOT_METRICS
                .filter(m => !snapshot.metrics[m.attr])
                .map(m => <option key={m.attr} value={m.attr}>{m.icon} {m.label}</option>)
            }
          </select>
        </div>
        {Object.entries(snapshot.metrics).map(([attr, value]) => (
          <Meter key={attr}
                 value={value}
                 onChange={update(attr)}
                 onLongPress={() => update(attr)(null)}
                 {...SNAPSHOT_METRICS.find(m => m.attr === attr)} />
        ))}
      </div>

      {habits.length === 0 ? null : (
        <div className='habits'>
          <div className='flex-row'>
            <span className='spacer'></span>
            <select value='' onChange={e => addHabit(+e.target.value)}>
              <option disabled value=''>Complete a habit...</option>
              {
                habits
                  .filter(h => snapshot.habitIds.indexOf(h.id) < 0)
                  .map(h => <option key={h.id} value={h.id}>{h.name}</option>)
              }
            </select>
          </div>
          {snapshot.habitIds.map(id => (
            <div key={id} className='flex-row' onClick={() => removeHabit(id)}>
              <span className='spacer'>☑</span><span>{habits.find(h => h.id === id).name}</span>
            </div>
          ))}
        </div>
      )}

      <Text value={snapshot.note || ''} update={note => db.snapshots.update(id, { note })} />

      <Delete onClick={() => db.snapshots.delete(id).then(() => navigate('/'))} />
    </div>
  )
}


const Text = ({ value, update }) => {
  const [isEditing, setIsEditing] = useState(false)
  return (
    <div className='note flex-row'>
      <span className='spacer'>📝</span>
      {isEditing ? (
        <textarea autoFocus defaultValue={value}
                  onBlur={e => { setIsEditing(false); update(e.target.value) }} />
      ) : (
        <div className={`rendered ${value ? '' : 'empty'}`}
             onClick={() => setIsEditing(true)}
             dangerouslySetInnerHTML={{
               __html: new showdown.Converter().makeHtml(value || 'Add a note...')
             }} />
      )}
    </div>
  )
}
