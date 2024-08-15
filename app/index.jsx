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
  Outlet,
  RouterProvider,
  useNavigate,
} from 'react-router-dom'

//import eruda from 'eruda'
//eruda.init()

import { db } from './db.jsx'

import Habit from './habit.jsx'
import NewHabit from './new-habit.jsx'
import NewSleep from './new-sleep.jsx'
import NewSnapshot from './new-snapshot.jsx'
import NewWorkout from './new-workout.jsx'
import Settings from './settings.jsx'
import Snapshot from './snapshot.jsx'
import Timeline from './timeline.jsx'
import Workout from './workout.jsx'

import './index.styl'


const Index = () => {
  const navigate = useNavigate()
  const habits_ = useLiveQuery(() => db.habits.toArray())
  const snapshots = useLiveQuery(() => db.snapshots.filter(s => s.habitIds?.length > 0).toArray())

  if (!habits_ || !snapshots) return null

  // Turn habits into a map from ID to object.
  const habits = Object.fromEntries(habits_.map(h => [h.id, { ...h, snapshots: [] }]))
  // Add snapshots to the corresponding habit object.
  snapshots.forEach(s => s.habitIds.forEach(i => habits[i].snapshots.push(s)))

  return (
    <div className='dashboard container'>
      {Object.values(habits).sort((a, b) => a.name.localeCompare(b.name)).map(habit => {
        //const when = dayjs.unix(snapshot.utc).tz(snapshot.tz)
        //<span className='when' title={when.format('llll')}>{when.fromNow()}</span>
        return (
          <div key={habit.id}>
            <Link to={`/habit/${habit.id}/`}>{habit.name}</Link>
          </div>
        )
      })}
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
    <nav>
      <Link title='Home' to='/'>👁️️</Link>
      <Link title='Timeline' to='/timeline/'>📅️</Link>
      <span className='sep'></span>
      <Link title='Take a Snapshot' to='/snapshot/new'>📷️</Link>
      <Link title='Start Sleeping' to='/sleep/new/'>💤</Link>
      <Link title='New Workout' to='/workout/new/'>🏋️</Link>
      <Link title='New Habit' to='/habit/new/'>☑️️</Link>
      <span className='sep'></span>
      <Link title='Settings' to='/settings/'>️️⚙️</Link>
    </nav>
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
        { path: '/habit/new/', element: <NewHabit /> },
        { path: '/sleep/new/', element: <NewSleep /> },
        { path: '/snapshot/:id/', element: <Snapshot /> },
        { path: '/snapshot/new/', element: <NewSnapshot /> },
        { path: '/workout/:id/', element: <Workout /> },
        { path: '/workout/new/', element: <NewWorkout /> },
        { path: '/settings/', element: <Settings /> },
      ],
    }])} />
)
