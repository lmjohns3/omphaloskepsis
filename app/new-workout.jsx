import React, { useMemo, useState } from 'react'
import { useLoaderData, useNavigate, useParams } from 'react-router-dom'
import Select, { createFilter } from 'react-select'

import { apiRead, apiUpdate } from './api.jsx'
import lib from './lib.jsx'

import './workout.styl'


const NewWorkout = () => {
  const navigate = useNavigate()
  const { exercises, workouts } = useLoaderData()
  const [goals, setGoals] = useState([])
  const [shuffle, setShuffle] = useState(false)
  const [repeats, setRepeats] = useState(false)
  const [numRepeats, setNumRepeats] = useState(2)

  const update = idx => (attr, value) => setGoals(cur => [
    ...cur.slice(0, idx),
    { ...cur[idx], [attr]: value },
    ...cur.slice(idx + 1),
  ])

  const updateAll = (attr, value) => {
    setGoals(cur => cur.map(goal => ({ ...goal, [attr]: value })))
  }

  const startWorkout = () => {
    let expanded = []
    const limit = repeats ? numRepeats : 1
    for (let i = 0; i < limit; ++i)
      expanded.push(...(shuffle ? lib.shuffle(goals) : goals))
    apiUpdate('collections', { flavor: 'workout', goals: JSON.stringify(expanded) })
      .then(res => navigate(`/workout/${res.id}/`))
  }

  console.log(goals)

  return (
    <div className='workout new container'>
      <h2>New Workout</h2>

      <table className='goals'>
        <thead><tr><td></td><th>🪨 Force</th><th>🧮 Reps</th><th>📍️ Distance</th><th>⏲️ Time</th></tr></thead>
        {goals.map((goal, idx) => (
          <tbody key={idx}>
            <tr key='name'>
              <td><button className='remove' onClick={() => setGoals(
                            cur => [ ...cur.slice(0, idx), ...cur.slice(idx + 1) ])}>×</button></td>
              <td colSpan='4'>{goal.name}</td>
            </tr>
            <tr key='targets'>
              <td></td>
              <Cell key='difficulty'
                    attr='difficulty'
                    goal={goal}
                    updateAll={updateAll}
                    update={update(idx)} />
              <Cell key='reps'
                    attr='reps'
                    goal={goal}
                    parse={parseInt}
                    updateAll={updateAll}
                    update={update(idx)} />
              <Cell key='distance_m'
                    attr='distance_m'
                    goal={goal}
                    parse={parseInt}
                    updateAll={updateAll}
                    update={update(idx)} />
              <Cell key='duration_s'
                    attr='duration_s'
                    goal={goal}
                    format={value => value ? lib.formatDuration(value) : ''}
                    parse={lib.parseDuration}
                    updateAll={updateAll}
                    update={update(idx)} />
            </tr>
          </tbody>))}
        <tfoot>
          <tr><td></td><td colSpan='4'>
            <Select
              key={goals.map(({ name }) => name).join('-')}
              placeholder='Add an exercise...'
              options={Object.entries(exercises).sort((a, b) => a[0].localeCompare(b[0]))}
              filterOption={createFilter({
                stringify: option => `${option.label} ${exercises[option.label].tags.join(' ')}`
              })}
              getOptionLabel={([name, _]) => name}
              getOptionValue={([name, _]) => name}
              styles={{
                control: (base, state) => ({ ...base, backgroundColor: '#444' }),
                placeholder: (base, state) => ({ ...base, color: 'inherit' }),
                menu: (base, state) => ({ ...base, backgroundColor: '#444' }),
                option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#333' : 'inherit' }),
              }}
              onChange={([name, _]) => setGoals(cur => [...cur, { name }])}
            /></td></tr>
        </tfoot>
      </table>

      <span id='repeats' className={`toggle ${repeats ? 'toggled' : ''}`}
            onClick={() => setRepeats(s => !s)}></span>
      <label htmlFor='repeats'>Repeat</label>
      {repeats ? <input id='num-repeats' value={numRepeats} onChange={e => setNumRepeats(e.target.value)} /> : null}
      <br/>
      <span id='shuffle' className={`toggle ${shuffle ? 'toggled' : ''}`}
            onClick={() => setShuffle(s => !s)}></span>
      <label htmlFor='shuffle'>Shuffle</label>

      {goals.length ? <button className='start' onClick={startWorkout}>⏱️ Start!</button> : null}

      {goals.length ? null : <h2>Copy from another workout...</h2>}
      {goals.length ? null : (
        <ul className='other-workouts'>{Object.entries(workouts).map(([name, exs]) => (
          exs.length < 2 ? null : (
            <li key={name}>
              <button className='add' onClick={() => setGoals(cur => [...cur, ...exs.map(n => ({ name: n }))])}>+</button>
              <span className='name'>{name}</span>
              {exs.map(n => <span key={n} className='exercise'>{n}</span>)}
            </li>
          )))}</ul>)}
    </div>
  )
}


const Cell = ({ goal, attr, format, parse, update, updateAll }) => {
  const [isEditing, setIsEditing] = useState(false)
  const fmt = format ? format : (v => v)
  const prs = parse ? parse : (v => v)
  return <td>{isEditing ? (
    <input autoFocus
           onFocus={e => e.target.select()}
           onBlur={e => { setIsEditing(false); update(attr, prs(e.target.value)) }}
           defaultValue={fmt(goal[attr])} />
  ) : (<>
    <span onClick={() => setIsEditing(true)}>{fmt(goal[attr]) || '--'}</span>
    <button className='update-all' onClick={() => updateAll(attr, goal[attr])}>↕</button>
  </>)}</td>
}


export { NewWorkout }
