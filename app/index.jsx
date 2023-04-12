import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Link, Route, useHistory } from 'react-router-dom'

import { Event } from './event.jsx'
import { Sleep } from './sleep.jsx'
import { Timeline } from './timeline.jsx'
import { Workout } from './workout.jsx'
import { postTo } from './common.jsx'

import './color.styl'
import './common.styl'

const Navigation = () => {
  const history = useHistory()

  const add = (dtype, args) => postTo(
    dtype, args, data => history.push(`/${args.activity || 'event'}/${data.uid}/`))

  return <nav><ul>
    <li><Link title='Timeline View' to='/timeline/'>🗓️</Link></li>
    <li className='sep'></li>
    <li><span className='new'
              title='New Note'
              onClick={() => add('events', { note: '' })}>🗒️️</span></li>
    <li><span className='new'
              title='New Sleep'
              onClick={() => add('spans', { activity: 'sleep' })}>💤</span></li>
    <li><span className='new'
              title='New Workout'
              onClick={() => add('spans', { activity: 'workout' })}>🏋️</span></li>
    <li className='sep'></li>
    <li><Link title='Log Out' to='/logout/'>🚪</Link></li>
  </ul></nav>
}

// Intl.DateTimeFormat().resolvedOptions().timeZone

ReactDOM.render(
  <BrowserRouter>
    <Navigation />
    <Route exact path='/'><Timeline /></Route>
    <Route path='/timeline/'><Timeline /></Route>
    <Route path='/event/:uid/'><Event /></Route>
    <Route path='/sleep/:uid/'><Sleep /></Route>
    <Route path='/workout/:uid/'><Workout /></Route>
  </BrowserRouter>,
  document.getElementById('app'))
