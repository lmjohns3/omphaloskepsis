import { useLiveQuery } from 'dexie-react-hooks'
import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Select, { createFilter } from 'react-select'

import { EXERCISE_METRICS, Meter } from './common.jsx'
import { EXERCISES, WORKOUTS } from './exercises.jsx'
import { db } from './db.jsx'
import lib from './lib.jsx'

import './workout.styl'


export default () => {
  const navigate = useNavigate()

  const [goals, setGoals] = useState([])
  const [shuffle, setShuffle] = useState(false)
  const [repeats, setRepeats] = useState(false)
  const [numRepeats, setNumRepeats] = useState(2)

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

  const removeGoal = idx => () => setGoals(cur => [
    ...cur.slice(0, idx), ...cur.slice(idx + 1)
  ])

  const startWorkout = async () => {
    let expanded = []
    for (let i = 0; i < (repeats ? numRepeats : 1); ++i)
      expanded.push(...(shuffle ? lib.shuffle(goals) : goals))
    navigate(`/workout/${await db.workouts.add({ goals: expanded })}/`)
  }

  return (
    <div className='new-workout container'>
      <h1>New Workout</h1>

      {goals.map((goal, i) => (
        <div key={i}>
          <h2 className='exercise-name'>{goal.name}</h2>
          {EXERCISE_METRICS.map(m => goal[m.attr] ? <Meter key={m.attr}
                                                           value={goal[m.attr]}
                                                           onClick={broadcastAttr(i, m.attr)}
                                                           onLongPress={removeAttr(i, m.attr)}
                                                           onChange={setAttr(id, m.attr)}
                                                           {...m} /> : null)}
          <div className='available'>{EXERCISE_METRICS.map(
            m => goal[m.attr] ? null : <span key={m.attr} title={m.label} onClick={() => setAttr(id, m.attr)(0)}>{m.emoji}</span>
          )}</div>
        </div>))}

      <Select
        key={goals.map(({ name }) => name).join('-')}
        placeholder='Add an exercise...'
        options={Object.entries(EXERCISES).sort((a, b) => a[0].localeCompare(b[0]))}
        filterOption={createFilter({
          stringify: option => `${option.label} ${EXERCISES[option.label].tags.join(' ')}`
        })}
        getOptionLabel={([name, _]) => name}
        getOptionValue={([name, _]) => name}
        onChange={([name, _]) => setGoals(cur => [...cur, { name }])}
      />

      {goals.length ? (
        <div className='repeats'>
          <span id='repeats' className={`toggle ${repeats ? 'toggled' : ''}`} onClick={() => setRepeats(s => !s)}></span>
          <label htmlFor='repeats'>Repeat</label>
          {repeats ? <input id='num-repeats' value={numRepeats} onChange={e => setNumRepeats(e.target.value)} /> : null}
        </div>
      ) : null}

      {goals.length > 1 ? (
        <div className='shuffle'>
          <span id='shuffle' className={`toggle ${shuffle ? 'toggled' : ''}`} onClick={() => setShuffle(s => !s)}></span>
          <label htmlFor='shuffle'>Shuffle</label>
        </div>
      ) : null}

      {goals.length ? <button className='start' onClick={startWorkout}>Start!</button> : null}
    </div>
  )
}
