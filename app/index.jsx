import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Link, Route, useHistory, useLocation } from 'react-router-dom'

import { apiRead } from './api.jsx'
import { Account, AccountContext } from './account.jsx'
import { Collection } from './collection.jsx'
import { Login, Logout } from './login.jsx'
import { Snapshot } from './snapshot.jsx'
import { Timeline } from './timeline.jsx'
import { Workout } from './workout.jsx'

import './color.styl'
import './common.styl'


const Interstitial = () => <div className='container'>Hold on a sec...</div>


const App = () => {
  const history = useHistory()
  const location = useLocation()
  const [account, setAccount] = useState(null)

  useEffect(() => {
    if (account) {
      if (location.pathname === '/') history.replace('/timeline/')
    } else {
      apiRead('account')
        .then(setAccount)
        .catch(() => history.replace('/login/'))
    }
  }, [account])

  return (
    <AccountContext.Provider value={{ account, setAccount }}>
      <nav>
        <ul>
          <li><Link title='Timeline View' to='/timeline/'>🗓️</Link></li>
          <li className='sep'></li>
          <li><Link title='Settings' to='/account/'>⚙️</Link></li>
          <li><Link title='Log Out' to='/logout/'>🚪</Link></li>
        </ul>
      </nav>
      <Route exact path='/'><Interstitial /></Route>
      <Route path='/account/'><Account /></Route>
      <Route path='/login/'><Login /></Route>
      <Route path='/logout/'><Logout /></Route>
      <Route path='/timeline/'><Timeline /></Route>
      <Route path='/snapshot/:id/'><Snapshot /></Route>
      <Route path='/collection/:id/'><Collection /></Route>
      <Route path='/workout/:id/'><Workout /></Route>
    </AccountContext.Provider>
  )
}


ReactDOM.render(<BrowserRouter><App /></BrowserRouter>, document.getElementById('app'))
