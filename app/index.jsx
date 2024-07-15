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
  Link,
  NavLink,
  Outlet,
  RouterProvider,
  useNavigate,
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
  const navigate = useNavigate()
  const snapshots = useLiveQuery(async () => await db.snapshots.toArray())

  return (
    <div className='dashboard container'>
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


const App = () => {
  const navigate = useNavigate()

  return (
    <>
      <nav><ul>
        <li><NavLink title='Home' to='/'>👁️️</NavLink></li>
        <li><NavLink title='Timeline' to='/timeline/'>📅️</NavLink></li>
        <li><NavLink title='Habits' to='/habits/'>☑️️</NavLink></li>
        <li className='sep'></li>
        <li><a title='Take a Snapshot' onClick={() => createSnapshot().then(id => navigate(`/snapshot/${id}/`))}>📷️</a></li>
        <li><a title='Go to Sleep' onClick={() => createSleep().then(id => navigate(`/snapshot/${id}/`))}>💤</a></li>
      </ul></nav>
      <Outlet />
    </>
  )
}


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
