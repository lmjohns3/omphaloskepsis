import './color.styl'
import './common.styl'

import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  createHashRouter,
  NavLink,
  Outlet,
  RouterProvider,
} from 'react-router-dom'

//import eruda from 'eruda'
//eruda.init()

import Dashboard from './dashboard.jsx'
import Habit from './habits.jsx'
import NewWorkout from './new-workout.jsx'
import Snapshot from './snapshot.jsx'
import Timeline from './timeline.jsx'
import Workout from './workout.jsx'

import './index.styl'


const Error = err => (
  <div className='error container'>
    <h1>Error</h1>
    <pre>{JSON.stringify(err, 4)}</pre>
  </div>
)


const App = () => (
  <>
    <nav><ul>
      <li><NavLink title='Dashboard' to='/'>👁️️</NavLink></li>
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
        { index: true, element: <Dashboard /> },
        { path: '/timeline/', element: <Timeline /> },
        { path: '/habit/:id/', element: <Habit /> },
        { path: '/snapshot/:id/', element: <Snapshot /> },
        { path: '/workout/:id/', element: <Workout /> },
        { path: '/workout/new/', element: <NewWorkout /> },
      ],
    }])} />
)
