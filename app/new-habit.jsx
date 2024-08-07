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
  const [goal, setGoal] = useState(2)
  const [periodCount, setPeriodCount] = useState(3)
  const [periodUnit, setPeriodUnit] = useState('day')

  return (
    <div className='habit container'>
      <h2 className='flex-row'>
        <span>New Habit:</span>
        <input type='text' autoFocus name='name' value={name} onChange={e => setName(e.target.value)} />
      </h2>
      <span className='flex-row'>
        <span className='spacer'></span>
        <span>Goal:</span>
        <input type='number' min='1' name='goal' value={goal} onChange={e => setGoal(e.target.value)} />
        <span>completion{goal > 1 ? 's' : ''} every</span>
        <input type='number' min='1' name='periodCount' value={periodCount} onChange={e => setPeriodCount(e.target.value)} />
        <select name='periodUnit' value={periodUnit} onChange={e => setPeriodUnit(e.target.value)}>
          {Object.keys(PERIOD_UNITS).map(k => <option key={k} value={k}>{k}{periodCount > 1 ? 's' : ''}</option>)}
        </select>
      </span>
      <span className='flex-row'>
        <span className='spacer'></span>
        <button onClick={() => db.habits.add({ name, goal, perSeconds: periodCount * PERIOD_UNITS[periodUnit] })
                                        .then(id => navigate(`/habit/${id}/`))}>Create</button>
      </span>
    </div>
  )
}
