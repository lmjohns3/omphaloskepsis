import './color.styl'
import './common.styl'

import React, { StrictMode, useEffect, useState } from 'react'
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

import { apiCreate, apiRead, apiUpdate } from './api.jsx'
import { Account } from './account.jsx'
import { AuthProvider, AuthRequired, useAuth } from './auth.jsx'
import { Collection } from './collection.jsx'
import { Mood } from './common.jsx'
import { Map, useGeo } from './geo.jsx'
import { Graphs } from './graphs.jsx'
import { Login } from './login.jsx'
import { NewWorkout } from './new-workout.jsx'
import { Snapshot } from './snapshot.jsx'
import { Timeline } from './timeline.jsx'

import './index.styl'


const Splash = () => (
  <div className='splash'>
    <h1 id='omphaloskepsis' title='Omphaloskepsis (navel gazing)'>ὀμφᾰλοσκέψῐς</h1>
    <p>👁️ navel gazing for 🏋️ physical and 🧘 mental health</p>
    <p><Link to='/login/'>Log In</Link></p>
  </div>
)


const Dashboard = () => {
  const navigate = useNavigate()
  const [mood, setMood] = useState(null)
  const [note, setNote] = useState('')
  const [coords, setCoords] = useState(null)

  useGeo().then(geo => setCoords(geo?.coords))

  return (
    <div className='dashboard container'>
      <h1>Welcome.</h1>
      <div className='cards'>
        <div className='card'>
          <h2>Where are you?</h2>
          {coords ? <Map lat={coords.latitude}
                         lng={coords.longitude}
                         onChanged={([lat, lng]) => setCoords({ latitude: lat, longitude: lng })} />
           : <button onClick={() => useGeo().then(geo => setCoords(geo?.coords))}>Map</button>}
        </div>
        <div className='card'>
          <h2>How are you feeling?</h2>
          <Mood value={mood} update={setMood} />
        </div>
        <div className='card'>
          <h2>Want to write?</h2>
          <textarea autoFocus defaultValue={note} onChange={e => setNote(e.target.value)}></textarea>
        </div>
      </div>
      <button onClick={() => apiCreate('snapshots', { mood, note }).then(res => navigate(`/snapshot/${res.id}/`))}>Save</button>
    </div>
  )
}


const Error = err => {
  const location = useLocation()
  return location.pathname.startsWith('/login') ?
    <Login /> : <Navigate to='/login/' replace state={{ then: location }} />
}


const App = () => {
  const { token, clearToken } = useAuth()

  //useEffect(() => { eruda.init() }, [])

  const nav = token ? (
    <ul>
      <li><NavLink title='Dashboard' to='/'>🖥️️</NavLink></li>
      <li><NavLink title='Timeline' to='/timeline/'>🗓️</NavLink></li>
      <li><NavLink title='Graphs' to='/graphs/'>📊️</NavLink></li>
      <li className='sep'></li>
      <li><Link title='New Snapshot' to='/snapshot/new/'>📷️</Link>️</li>
      <li><Link title='Start Sleeping' to='/sleep/new/'>💤</Link></li>
      <li><Link title='New Workout' to='/workout/new/'>🏋️</Link></li>
      <li className='sep'></li>
      <li><NavLink title='Settings' to='/account/'>⚙️</NavLink></li>
      <li><Link title='Log Out' onClick={clearToken}>🚪</Link></li>
    </ul>
  ) : null

  return <><nav>{nav}</nav><Outlet /></>
}


ReactDOM.createRoot(
  document.getElementById('app')
).render(
  <RouterProvider
    router={createBrowserRouter([{
      path: '/',
      loader: () => apiUpdate('token').catch(() => null),
      element: <AuthProvider><App /></AuthProvider>,
      children: [
        { path: '/login/', element: <Login /> },
        { path: '/splash/', element: <StrictMode><Splash /></StrictMode> },
        {
          path: '/',
          element: <AuthRequired><Outlet /></AuthRequired>,
          errorElement: <Error />,
          children: [
            { index: true, element: <Dashboard /> },
            { path: '/account/', loader: () => apiRead('account'), element: <Account /> },
            { path: '/timeline/', loader: () => apiRead('timeline'), element: <Timeline /> },
            { path: '/graphs/', loader: () => apiRead('graphs'), element: <Graphs /> },
            { path: '/workout/new/', loader: () => apiRead('workouts'), element: <NewWorkout /> },
            {
              path: '/sleep/new/',
              loader: () => apiCreate(
                'snapshots', { flavor: 'sleep' }
              ).then(res => redirect(`/snapshot/${res.id}/`)),
              element: <div>Loading...</div>,
            },
            {
              path: '/snapshot/new/',
              loader: () => apiCreate(
                'snapshots'
              ).then(res => redirect(`/snapshot/${res.id}/`)),
              element: <div>Loading...</div>,
            },
            {
              path: '/snapshot/:id/',
              loader: ({ params }) => apiRead(`snapshot/${params.id}`),
              element: <Snapshot />,
            },
            {
              path: '/collection/:id/',
              loader: ({ params }) => apiRead(`collection/${params.id}`),
              element: <Collection />,
            },
          ],
        },
      ],
    }])} />
)
