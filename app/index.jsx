import './color.styl'
import './common.styl'

import React, { StrictMode, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  Link,
  NavLink,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouteError,
} from 'react-router-dom'

//import eruda from 'eruda'

import { apiRead, apiUpdate } from './api.jsx'
import { Account } from './account.jsx'
import { AuthProvider, AuthRequired, useAuth } from './auth.jsx'
import { Collection } from './collection.jsx'
import { ConfigContext } from './common.jsx'
import { Login } from './login.jsx'
import { NewWorkout } from './new-workout.jsx'
import { Snapshot } from './snapshot.jsx'
import { Timeline } from './timeline.jsx'
import { Workout } from './workout.jsx'

import './index.styl'


const Index = () => {
  const { token } = useAuth()
  return token ? <Dashboard /> : <Splash />
}


const Splash = () => (
  <div className='splash'>
    <h1 id='omphaloskepsis' title='Omphaloskepsis (navel gazing)'>ὀμφᾰλοσκέψῐς</h1>
    <p>👁️ navel gazing for <br/>🏋️ physical and <br/>🧘 mental health</p>
    <p><Link to='/signup/'>Sign Up</Link> or <Link to='/login/'>Log In</Link></p>
  </div>
)


const Dashboard = () => (
  <div className='dashboard'>Dashboard.</div>
)


const App = () => {
  const navigate = useNavigate()
  const { token, clearToken } = useAuth()

  //useEffect(() => { eruda.init() }, [])

  const nav = token ? (
    <nav>
      <ul>
        <li><NavLink title='Dashboard' to='/'>🖥️️</NavLink></li>
        <li><NavLink title='Timeline' to='/timeline/'>🗓️</NavLink></li>
        <li><NavLink title='Graphs' to='/graphs/'>📊️</NavLink></li>
        <li className='sep'></li>
        <li><Link title='New Note' to='#' onClick={() => apiCreate('snapshots').then(res => navigate(`/snapshot/${res.id.toString(36)}/`))}>🗒️</Link>️</li>
        <li><Link title='Start Sleeping' to='#' onClick={() => apiCreate('collections', { tags: ['sleep'] }).then(res => navigate(`/snapshot/${res.snapshots[0].id.toString(36)}/`))}>💤</Link></li>
        <li><Link title='New Workout' to='/workout/new/'>🏋️</Link></li>
        <li className='sep'></li>
        <li><NavLink title='Settings' to='/account/'>⚙️</NavLink></li>
        <li><Link title='Log Out' onClick={clearToken}>🚪</Link></li>
      </ul>
    </nav>
  ) : null

  return <>{nav}<Outlet /></>
}


const Error = err => `Error! ${Object.keys(err).join(' ')}`


ReactDOM.createRoot(
  document.getElementById('app')
).render(
  <RouterProvider
    router={createBrowserRouter([{
      path: '/',
      loader: async () => {
        try { return await apiUpdate('token') } catch (err) {}
        return null
      },
      element: <AuthProvider><App /></AuthProvider>,
      //errorElement: <Error />,
      children: [
        { index: true, element: <Index /> },
        { path: '/login', element: <Login /> },
        {
          path: '/account',
          element: <AuthRequired><Account /></AuthRequired>,
        },
        {
          path: '/timeline',
          loader: () => apiRead('timeline'),
          element: <AuthRequired><Timeline /></AuthRequired>,
        },
        {
          path: '/snapshot/:id',
          loader: ({ params }) => apiRead(`snapshot/${params.id}`),
          element: <AuthRequired><Snapshot /></AuthRequired>,
        },
        {
          path: '/collection/:id',
          loader: ({ params }) => apiRead(`collection/${params.id}`),
          element: <AuthRequired><Collection /></AuthRequired>,
        },
        {
          path: '/workout/new',
          loader: () => apiRead('workouts'),
          element: <AuthRequired><NewWorkout /></AuthRequired>,
        },
        {
          path: '/workout/:id',
          loader: ({ params }) => apiRead(`workout/${params.id}`),
          element: <AuthRequired><Workout /></AuthRequired>,
        },
      ],
    }])} />
)
