import './color.styl'
import './common.styl'

import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  Link,
  NavLink,
  Outlet,
  redirect,
  RouterProvider,
  useRouteError,
} from 'react-router-dom'

//import eruda from 'eruda'
//eruda.init()

import { apiRead, apiUpdate } from './api.jsx'
import { Account } from './account.jsx'
import { AuthProvider, AuthRequired, useAuth } from './auth.jsx'
import { Collection } from './collection.jsx'
import { Dashboard } from './dashboard.jsx'
import { Habits } from './habits.jsx'
import { Login } from './login.jsx'
import { NewWorkout } from './new-workout.jsx'
import { Snapshot } from './snapshot.jsx'
import { Timeline } from './timeline.jsx'
import { Workout } from './workout.jsx'

import './index.styl'


const Splash = () => (
  <div className='splash'>
    <h1 id='omphaloskepsis' title='Omphaloskepsis (navel gazing)'>ὀμφᾰλοσκέψῐς</h1>
    <p>
      <span>👁️ navel gazing for</span>
      <span>🏋️ physical and</span>
      <span>🧘 mental health</span>
    </p>
    <p><Link to='/login/'>Log In</Link></p>
  </div>
)


const Error = err => (
  <div className='error container'>
    <h1>Error</h1>
    <pre>{JSON.stringify(err, 4)}</pre>
  </div>
)


const Index = () => useAuth().token ? <Dashboard /> : <Splash />


const App = () => {
  const { token, clearToken } = useAuth()

  const nav = token ? (
    <nav><ul>
      <li><NavLink title='Dashboard' to='/'>👁️️</NavLink></li>
      <li><NavLink title='Hourly' to='/timeline/'>📅️</NavLink></li>
      <li><NavLink title='Daily' to='/calendar/'>🗓️️</NavLink></li>
      <li><NavLink title='Habits' to='/habits/'>☑️</NavLink></li>
      <li className='sep'></li>
      <li><NavLink title='Settings' to='/account/'>⚙️</NavLink></li>
      <li><Link title='Log Out' onClick={clearToken}>🚪</Link></li>
    </ul></nav>
  ) : null

  return <>{nav}<Outlet /></>
}


ReactDOM.createRoot(
  document.getElementById('app')
).render(
  <RouterProvider
    router={createBrowserRouter([{
      path: '/',
      loader: () => apiUpdate('token'),
      element: <AuthProvider><App /></AuthProvider>,
      //errorElement: <Error />,
      children: [
        {
          index: true,
          loader: () => apiRead('dashboard'),
          element: <Index />,
        },
        {
          path: '/account/',
          loader: () => apiRead('account'),
          element: <AuthRequired><Account /></AuthRequired>,
        },
        {
          path: '/collection/:id/',
          loader: ({ params }) => apiRead(`collection/${params.id}`),
          element: <AuthRequired><Collection /></AuthRequired>,
        },
        {
          path: '/habits/',
          loader: () => apiRead('habits'),
          element: <AuthRequired><Habits /></AuthRequired>,
        },
        {
          path: '/login/',
          element: <Login />,
        },
        {
          path: '/snapshot/:id/',
          loader: ({ params }) => apiRead(`snapshot/${params.id}`),
          element: <AuthRequired><Snapshot /></AuthRequired>,
        },
        {
          path: '/timeline/',
          loader: () => apiRead('timeline'),
          element: <AuthRequired><Timeline /></AuthRequired>,
        },
        {
          path: '/workout/new/',
          loader: () => apiRead('workouts'),
          element: <AuthRequired><NewWorkout /></AuthRequired>,
        },
        {
          path: '/workout/:id/',
          loader: ({ params }) => apiRead(`collection/${params.id}`),
          element: <AuthRequired><Workout /></AuthRequired>,
        },
      ],
    }])} />
)
