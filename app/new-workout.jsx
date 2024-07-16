import { useLiveQuery } from 'dexie-react-hooks'
import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Select, { createFilter } from 'react-select'

import { Meter, METRICS } from './common.jsx'
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
    const id = await db.workouts.add({})
    for (let i = 0; i < expanded.length; ++i)
      db.exercises.add({ ...expanded[i], order: i, workout: { id } })
    navigate(`/workout/${id}/`)
  }

  return (
    <div className='new-workout'>
      <h1>Workout Goals</h1>

      {goals.map((goal, i) => (
        <div key={i}>
          <h2 className='exercise-name'>{goal.name}</h2>
          {METRICS.exercise.map(m => m.attr in goal ? <Meter key={m.attr}
                                                             value={goal[m.attr]}
                                                             onEmojiClick={broadcastAttr(i, m.attr)}
                                                             onEmojiLongPress={removeAttr(i, m.attr)}
                                                             onChange={setAttr(i, m.attr)}
                                                             {...m} /> : null)}
          <div className='available'>{METRICS.exercise.map(
            m => m.attr in goal ? null : <span key={m.attr}
                                               title={m.label}
                                               onClick={() => setAttr(i, m.attr)(0)}>{m.emoji}</span>
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
        styles={{
          container: (base, state) => ({ ...base, padding: '0.5em 0.5em 0.5em 2.5rem', maxWidth: '22em' }),
          control: (base, state) => ({ ...base, backgroundColor: '#444' }),
          menu: (base, state) => ({ ...base, backgroundColor: '#444' }),
          option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#333' : 'inherit' }),
          placeholder: (base, state) => ({ ...base, color: 'inherit' }),
        }}
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
