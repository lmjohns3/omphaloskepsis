import './color.styl'
import './common.styl'

import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  createHashRouter,
  NavLink,
  Outlet,
  redirect,
  RouterProvider,
} from 'react-router-dom'

//import eruda from 'eruda'
//eruda.init()

import { createSnapshot, db } from './db.jsx'

import Habit from './habits.jsx'
import NewWorkout from './new-workout.jsx'
import Snapshot from './snapshot.jsx'
import Timeline from './timeline.jsx'
import Workout from './workout.jsx'

import './index.styl'

const Index = () => {
  const snapshots = useLiveQuery(async () => await db.snapshots.toArray())

  return (
    <div className='dashboard container'>
      <div className='actions'>
        <button title='New Snapshot' onClick={() => createSnapshot().then(id => redirect(`/snapshot/${id}/`)}>📷️ Take a Snapshot</button>
        <button title='Start Sleeping'>💤 Start Sleeping</button>
        <button title='New Workout' onClick={() => redirect('/workout/new/')}>🏋️ Start a Workout</button>
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


const Error = err => (
  <div className='error container'>
    <h1>Error</h1>
    <pre>{JSON.stringify(err, 4)}</pre>
  </div>
)


const App = () => (
  <>
    <nav><ul>
      <li><NavLink title='Home' to='/'>👁️️</NavLink></li>
      <li><NavLink title='Timeline' to='/timeline/'>📅️</NavLink></li>
    </ul></nav>
    <Outlet />
  </>
)


ReactDOM.createRoot(
  document.getElementById('app')
).render(
  <RouterProvider
    router={createHashRouter([{
      path: '/',
      element: <App />,
      errorElement: <Error />,
      children: [
        { index: true, element: <Index /> },
        { path: '/timeline/', element: <Timeline /> },
        { path: '/habit/:id/', element: <Habit /> },
        { path: '/snapshot/:id/', element: <Snapshot /> },
        { path: '/workout/:id/', element: <Workout /> },
        { path: '/workout/new/', element: <NewWorkout /> },
      ],
    }])} />
)
