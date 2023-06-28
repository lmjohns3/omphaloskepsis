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
  useRouteError,
} from 'react-router-dom'

//import eruda from 'eruda'

import { apiRead } from './api.jsx'
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
  const { credentials } = useAuth()

  return credentials ? <Dashboard /> : <Splash />
}


const Splash = () => (
  <div className='splash'>
    <h1 id='omphaloskepsis' title='Omphaloskepsis (navel gazing)'>ὀμφᾰλοσκέψῐς</h1>
    <p>👁️ navel gazing for <br/>🏋️ physical and <br/>🧘 mental health</p>
    <p><Link to='/signup/'>Sign Up</Link> or <Link to='/login/'>Log In</Link></p>
  </div>
)


const Dashboard = () => {
  return (
    <AuthRequired>
      <div className='dashboard'>Dashboard.</div>
    </AuthRequired>
  )
}

const App = () => {
  const { token, clearToken } = useAuth()

  console.log('auth token', token)

  const navs = token ? [
    <NavLink title='Timeline View' to='/timeline/'>🗓️</NavLink>,
    <NavLink title='Graph View' to='/graphs/'>📊️</NavLink>,
    null,
    <NavLink title='Settings' to='/account/'>⚙️</NavLink>,
    <Link title='Log Out' onClick={clearToken}>🚪</Link>,
  ] : []

  //useEffect(() => { eruda.init() }, [])

  return (
    <>
      <nav><ul>{
        navs.map((n, i) => <li key={i} className={n ? '' : 'sep'}>{n}</li>)
      }</ul></nav>
      <Outlet />
    </>
  )
}


const Error = err => `Error! ${Object.keys(err).join(' ')}`


ReactDOM.createRoot(
  document.getElementById('app')
).render(
  <StrictMode>
    <RouterProvider
      router={createBrowserRouter([{
        path: '/',
        element: <AuthProvider><App /></AuthProvider>,
        //errorElement: <Error />,
        children: [
          { index: true, element: <Index /> },
          { path: '/login', element: <Login /> },
          { path: '/account', element: <AuthRequired><Account /></AuthRequired> },
          { path: '/timeline', element: <AuthRequired><Timeline /></AuthRequired> },
          {
            path: '/snapshot/:id',
            element: <AuthRequired><Snapshot /></AuthRequired>,
            loader: ({ params }) => apiRead(`/snapshot/${params.id}/`),
          },
          {
            path: '/collection/:id',
            element: <AuthRequired><Collection /></AuthRequired>,
            loader: ({ params }) => apiRead(`/collection/${params.id}/`),
          },
          {
            path: '/workout/new',
            element: <AuthRequired><NewWorkout /></AuthRequired>,
          },
          {
            path: '/workout/:id',
            element: <AuthRequired><Workout /></AuthRequired>,
            loader: ({ params }) => apiRead(`/workout/${params.id}/`),
          },
        ],
      }])} />
  </StrictMode>
)
