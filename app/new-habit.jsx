import React from 'react'
import { useState } from 'react'

import { db } from './db.jsx'
import lib from './lib.jsx'

import './habits.styl'


const PERIOD_UNITS = {
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7,
  month: 60 * 60 * 24 * 30,
}


export default () => {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState(1)
  const [periodCount, setPeriodCount] = useState(1)
  const [periodUnit, setPeriodUnit] = useState('day')

  return (
    <div className='habit container'>
      <h1>New Habit: <input type='text' autoFocus name='name' value={name} onChange={e => setName(e.target.value)} /></h1>
      <span>Goal: </span>
      <input type='number' min='1' name='goal' value={goal} onChange={e => setGoal(e.target.value)} />
      <span>time{goal > 1 ? 's' : ''} every</span>
      <input type='number' min='1' name='periodCount' value={periodCount} onChange={e => setPeriodCount(e.target.value)} />
      <select name='periodUnit' value={periodUnit} onChange={e => setPeriodUnit(e.target.value)}>
        {Object.keys(PERIOD_UNITS).map(k => <option key={k} value={k}>{k}{periodCount > 1 ? 's' : ''}</option>)}
      </select>
      <p><button onClick={() => db.habits.add({ name, goal, perSeconds: periodCount * PERIOD_UNITS[periodUnit] }).then(id => navigate(`/habit/${id}/`))}>Create</button></p>
    </div>
  )
}
