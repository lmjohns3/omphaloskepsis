import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import React from 'react'
import { Link, redirect, useLoaderData, useNavigate } from 'react-router-dom'

import { apiCreate } from './api.jsx'

import './dashboard.styl'


const Dashboard = () => {
  const navigate = useNavigate()
  const { snapshots } = useLoaderData() ?? { snapshots: [] }

  const startSnapshot = () => apiCreate('snapshots').then(res => redirect(`/snapshot/${res.id}/`))
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
        {snapshots.map(snapshot => {
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


export { Dashboard }
