import './color.styl'
import './common.styl'

import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  redirect,
  RouterProvider,
  useLocation,
  useNavigate,
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
import { NewWorkout } from './new-workout.jsx'
import { Snapshot } from './snapshot.jsx'
import { Timeline } from './timeline.jsx'
import { Workout } from './workout.jsx'

import './index.styl'


// https://html.spec.whatwg.org/multipage/input.html#e-mail-state-(type%3Demail)
const validEmailPattern = new RegExp(/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)


const Splash = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, handleToken } = useAuth()

  const emailInput = useRef(null)
  const passwordInput = useRef(null)

  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [needsEmail, setNeedsEmail] = useState(true)
  const [isValidEmail, setIsValidEmail] = useState(false)

  useEffect(() => { setIsValidEmail((validEmailPattern.test(email))) }, [email])

  useEffect(() => {
    const ref = (needsEmail ? emailInput : passwordInput).current
    if (ref) ref.focus()
  }, [needsEmail])

  const onSubmit = e => {
    e.preventDefault()
    setError(null)
    apiUpdate('login', { email, password })
      .then(handleToken)
      .then(() => navigate(location.state?.then ?? '/'))
      .catch(err => { setPassword(''); setError('Incorrect!') })
  }

  if (token) return <Navigate to={location.state?.then ?? '/'} />

  return (
    <div className='splash container'>
      <h1>Oomph!</h1>
      <p>
        <span>👁️ navel gazing for</span>
        <span>🏋️ physical and</span>
        <span>🧘 mental health</span>
      </p>
      <h2>Login / Signup</h2>
      {error ? <div className='error'>{error}</div> : null}
      <input ref={emailInput}
             type='email'
             placeholder='Email'
             autoFocus
             value={email}
             onChange={e => setEmail(e.target.value)}></input>
      {needsEmail ?
       <button disabled={!isValidEmail} onClick={() => setNeedsEmail(false)}>Continue</button> :
       <form onSubmit={onSubmit}>
         <input ref={passwordInput}
                type='password'
                placeholder='Password'
                value={password}
                onChange={e => setPassword(e.target.value)}></input>
         <button type='submit'>Log In</button>
       </form>}
      <h2>About</h2>
      <p>Oomph! gets its name from ὀμφᾰλοσκέψῐς, a meditation practice from
        ancient Greece that roughly means "navel gazing."</p>
    </div>
  )
}


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
