import { useLiveQuery } from 'dexie-react-hooks'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Select, { createFilter } from 'react-select'

import { EXERCISE_METRICS, Meter } from './common.jsx'
import { db } from './db.jsx'
import lib from './lib.jsx'

import './workout.styl'


export default () => {
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const workouts = useLiveQuery(() => db.workouts.filter(w => w.name).toArray())

  const [goals, setGoals] = useState([])
  const [shuffle, setShuffle] = useState(false)
  const [repeats, setRepeats] = useState(false)
  const [numRepeats, setNumRepeats] = useState(2)

  if (!exercises || !workouts) return null

  const exerciseIndex = {}
  exercises.forEach(ex => {
    exerciseIndex[ex.id] = ex
    exerciseIndex[ex.name] = ex
  })

  const setAttr = (idx, attr) => value => setGoals(cur => [
    ...cur.slice(0, idx),
    { ...cur[idx], [attr]: value },
    ...cur.slice(idx + 1),
  ])

  const removeAttr = (idx, attr) => () => setGoals(cur => {
    const { [attr]: _, ...remaining } = cur[idx]
    return [...cur.slice(0, idx), remaining, ...cur.slice(idx + 1)]
  })

  const broadcastAttr = (idx, attr) => () => {
    const value = goals[idx][attr]
    setGoals(cur => cur.map(goal => ({ ...goal, [attr]: value })))
  }

  const removeGoal = idx => () => setGoals(cur => [...cur.slice(0, idx), ...cur.slice(idx + 1)])

  const startWorkout = async () => {
    let expanded = []
    for (let i = 0; i < (repeats ? numRepeats : 1); ++i)
      expanded.push(...(shuffle ? lib.shuffle(goals) : goals))
    navigate(`/workout/${await db.workouts.add({ goals: expanded })}/`)
  }

  return (
    <div className='new-workout container'>
      <h2 className='flex-row'>
        <span>New Workout</span>
      </h2>

      <div className='flex-row'>
        <Select
          key='workouts'
          placeholder='Add exercises from...'
          options={workouts.sort((a, b) => a.name.localeCompare(b.name))}
          getOptionLabel={w => w.name}
          getOptionValue={w => w.name}
          onChange={w => setGoals(cur => [...cur, ...w.goals])}
          blurInputOnSelect={true}
          autoFocus={true}
        />
        <Select
          key='exercises'
          placeholder='Add an exercise...'
          options={exercises.sort((a, b) => a.name.localeCompare(b.name))}
          filterOption={createFilter({
              stringify: option => `${option.label} ${exerciseIndex[option.label].tags.join(' ')}`
          })}
          getOptionLabel={e => e.name}
          getOptionValue={e => e.name}
          onChange={e => setGoals(cur => [...cur, { id: e.id }])}
          blurInputOnSelect={true}
        />
      </div>

      {goals.map((goal, i) => (
        <div key={i}>
          <h3>{exerciseIndex[goal.id].name}</h3>
          {
            EXERCISE_METRICS
              .filter(m => m.attr in goal)
              .map(m => <Meter key={m.attr}
                               value={goal[m.attr]}
                               onClick={broadcastAttr(i, m.attr)}
                               onLongPress={removeAttr(i, m.attr)}
                               onChange={setAttr(i, m.attr)}
                               {...m} />)
          }
          <div className='flex-row'>
            <span className='spacer'>🎯</span>
            <select key={Object.keys(goal).join('-')}
                    defaultValue=''
                    onChange={e => setAttr(i, e.target.value)('')}>
              <option value='' disabled>Add a target...</option>
              {
                EXERCISE_METRICS
                  .filter(m => !(m.attr in goal))
                  .map(m => <option key={m.attr} value={m.attr}>{m.icon} {m.label}</option>)
              }
            </select>
          </div>
        </div>
      ))}

      {(goals.length > 0) && (
        <div className='flex-row'>
          <label className='checkbox-label' htmlFor='repeats' onClick={() => setRepeats(s => !s)}>
            <input id='repeats' type='checkbox' readOnly checked={repeats} />
            <span>Repeat</span>
          </label>
          {repeats ? <input id='num-repeats' value={numRepeats} onChange={e => setNumRepeats(e.target.value)} /> : null}
          <label className='checkbox-label' htmlFor='shuffle' onChange={() => setShuffle(s => !s)}>
            <input id='shuffle' type='checkbox' readOnly checked={shuffle} />
            <span>Shuffle</span>
          </label>
          <button className='start' onClick={startWorkout}>Start!</button>
        </div>
      )}
    </div>
  )
}
