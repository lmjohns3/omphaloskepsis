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

import Habit from './habit.jsx'
import NewHabit from './new-habit.jsx'
import NewWorkout from './new-workout.jsx'
import Snapshot from './snapshot.jsx'
import Timeline from './timeline.jsx'
import Workout from './workout.jsx'

import './index.styl'


const Index = () => {
  const navigate = useNavigate()
  const habits_ = useLiveQuery(() => db.habits.toArray())
  const habitSnapshots = useLiveQuery(() => db.snapshots.filter(s => s.habit?.id).toArray())

  if (!habits_ || !habitSnapshots) return null

  // Turn habits into a map from ID to habit object.
  const habits = Object.fromEntries(habits_.map(h => [h.id, { ...h, snapshots: [] }]))
  // Add snapshots to the corresponding habit object.
  habitSnapshots.forEach(s => habits[s.habit.id].snapshots.push(s))

  return (
    <div className='dashboard container'>
      <ul className='habits'>
        {Object.values(habits).sort((a, b) => a.name.localeCompare(b.name)).map(habit => {
          //const when = dayjs.unix(snapshot.utc).tz(snapshot.tz)
          //<span className='when' title={when.format('llll')}>{when.fromNow()}</span>
          return (
            <li key={habit.id}>
              <Link to={`/habit/${habit.id}/`}>{habit.name}</Link>
            </li>
          )
        })}
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
  const createSleep = async () => createSnapshot({ sleep: { id: await db.sleeps.add({}) } })

  return (
    <>
      <nav><ul>
        <li><NavLink title='Home' to='/'>👁️️</NavLink></li>
        <li><NavLink title='Timeline' to='/timeline/'>📅️</NavLink></li>
        <li className='sep'></li>
        <li><a title='Take a Snapshot' onClick={() => createSnapshot().then(id => navigate(`/snapshot/${id}/`))}>📷️</a></li>
        <li><a title='Go to Sleep' onClick={() => createSleep().then(id => navigate(`/snapshot/${id}/`))}>💤</a></li>
        <li><Link title='Start a Workout' to='/workout/new/'>🏋️</Link></li>
        <li><Link title='Start a Habit' to='/habit/new/'>☑️️</Link></li>
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
        { path: '/deletedeletedelete/', loader: () => db.delete() },
      ],
    }])} />
)
