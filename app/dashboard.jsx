import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import React from 'react'
import { Link, redirect, useNavigate } from 'react-router-dom'

import db from './db.jsx'
import { useGeo } from './geo.jsx'

import './dashboard.styl'


export default () => {
  const navigate = useNavigate()

  const snapshots = useLiveQuery(async () => await db.snapshots.toArray())

  const startSnapshot = async () => {
    const id = await db.snapshots.add({
      utc: dayjs.utc().unix(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    try {
      const geo = await useGeo(300)
      if (geo && geo.coords) {
        db.snapshots.put({ id, lat: geo.coords.latitude, lng: geo.coords.longitude })
      }
    } catch (e) {
      console.log(e)
    }
    navigate(`/snapshot/${id}/`)
  }
  const startSleep = () => apiCreate('snapshots', { flavor: 'sleep' }).then(res => redirect(`/snapshot/${res.id}/`))
  const startWorkout = () => navigate('/workout/new/')

  return (
    <div className='dashboard container'>
      <div className='actions'>
        <button title='New Snapshot' onClick={startSnapshot}>📷️ Take a Snapshot</button>
        <button title='Start Sleeping' onClick={startSleep}>💤 Start Sleeping</button>
        <button title='New Workout' onClick={startWorkout}>🏋️ Start a Workout</button>
      </div>
      <h1>Recent Snapshots</h1>
      <ul className='snapshots'>
        {snapshots?.map(snapshot => {
          const when = dayjs.unix(snapshot.utc).tz(snapshot.tz)
          return (
            <li key={snapshot.id}>
              <Link to={`/snapshot/${snapshot.id}/`}>
                <span className='icons'>
                  {snapshot.lat && '📍️'}
                  {snapshot.note && '📝'}
                </span>
                <span className='when' title={when.format('llll')}>{when.fromNow()}</span>
              </Link>
            </li>
          )})}
      </ul>
    </div>
  )
}
