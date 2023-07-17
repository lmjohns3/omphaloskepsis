import React, { useMemo, useState } from 'react'
import { useLoaderData, useNavigate, useParams } from 'react-router-dom'

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
  const [activeTag, setActiveTag] = useState('')

  const tags = useMemo(() => {
    const index = {}
    Object.entries(exercises).forEach(([name, { tags }]) => tags.forEach(tag => {
      if (!index[tag]) index[tag] = new Set()
      index[tag].add(name)
    }))
    return index
  }, [exercises])

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
    apiUpdate('collections', { flavor: 'workout', goals: JSON.stringify(goals) })
      .then(res => navigate(`/workout/${res.id}/`))
  }

  console.log(goals)

  return (
    <div className='workout new container'>
      <h1>
        {goals.length > 0 ? <button className='start' onClick={startWorkout}>⏱️ Start!</button> : null}
        <span>Workout Goals</span>
      </h1>

      {goals.length > 0 ? (
        <table className='goals'>
          <thead><tr><td></td><th>Exercise</th><th>🪨 Resistance</th><th>🧮 Reps</th><th>📍️ Distance</th><th>⏲️ Duration</th><td></td></tr></thead>
          <tbody>{goals.map((goal, idx) => (
            <tr key={idx}>
              <td key='move'>{shuffle ? null : '☷'}</td>
              <td key='name'>{goal.name}</td>
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
              <td key='remove'>
                <button className='remove' onClick={() => setGoals(
                          cur => [ ...cur.slice(0, idx), ...cur.slice(idx + 1) ])}>×</button>
              </td>
            </tr>))}
          </tbody>
        </table>
      ) : null}

      {goals.length > 0 ? (<>
        <span id='repeats' className={`toggle ${repeats ? 'toggled' : ''}`}
              onClick={() => setRepeats(s => !s)}></span>
        <label htmlFor='repeats'>Repeat</label>
        {repeats ? <input id='num-repeats' value={numRepeats} onChange={e => setNumRepeats(e.target.value)} /> : null}
        <br/>
        <span id='shuffle' className={`toggle ${shuffle ? 'toggled' : ''}`}
              onClick={() => setShuffle(s => !s)}></span>
        <label htmlFor='shuffle'>Shuffle</label>
      </>): null}

      <h2>Copy from another workout...</h2>
      <ul className='other-workouts'>{Object.entries(workouts).map(([name, exs]) => (
        exs.length < 2 ? null : (
          <li key={name}>
            <button className='add' onClick={() => setGoals(cur => [...cur, ...exs.map(n => ({ name: n }))])}>+</button>
            <span className='name'>{name}</span>
            {exs.map(n => <span key={n} className='exercise'>{n}</span>)}
          </li>
        )))}</ul>

      <h2>Add individual exercises...</h2>
      <select className='tags' onChange={e => setActiveTag(e.target.value)}>
        <option key='all' value=''>Filter...</option>
        {Object.keys(tags).sort().map(tag => <option key={tag} value={tag}>{tag}</option>)}
      </select>
      <ul className='exercises'>{
        Object.entries(exercises)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([name, ex]) => (activeTag === '' || ex.tags.indexOf(activeTag) >= 0) ? (
                <li key={name}>
                  <button className='add' onClick={() => setGoals(cur => [ ...cur, { name } ])}>+</button>
                  <img src={`/static/img/${ex.image}`} />
                  <span className='name'>{name}</span>
                </li>
              ) : null)
      }</ul>
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
    <span onClick={() => setIsEditing(true)}>{fmt(goal[attr]) || '---'}</span>
    <button className='update-all' onClick={() => updateAll(attr, goal[attr])}>↕</button>
  </>)}</td>
}


export { NewWorkout }
