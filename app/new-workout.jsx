import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { apiCreate, apiRead } from './api.jsx'
import lib from './lib.jsx'


const NewWorkout = () => {
  const navigate = useNavigate()
  const [config, setConfig] = useState(null)
  const [goals, setGoals] = useState([])
  const [shuffle, setShuffle] = useState(false)
  const [repeats, setRepeats] = useState(1)
  const [activeTag, activateTag] = useState(null)

  useEffect(() => { apiRead('config').then(setConfig) }, [])

  if (!config) return null

  const add = id => () => setGoals(cur => [ ...cur, { id } ])

  const addFromWorkout = key => () => setGoals(cur => [
    ...cur,
    ...config.workouts[key].map(n => ({ id: config.nameToId[n] })),
  ])

  const update = idx => (attr, value) => setGoals(cur => [
    ...cur.slice(0, idx),
    { ...cur[idx], [attr]: value },
    ...cur.slice(idx + 1),
  ])

  const updateAll = (attr, value) => {
    console.log(attr, value)
    setGoals(cur => cur.map(goal => ({ ...goal, [attr]: value })))
  }

  const startWorkout = () => {
    let expanded = []
    for (let i = 0; i < repeats; ++i)
      expanded.push(...(shuffle ? lib.shuffle(goals) : goals))
    apiCreate('workouts', { tags: ['workout'], goals: expanded })
      .then(res => navigate(`/workout/${res.id.toString(36)}/`))
  }

  console.log(goals)

  return (
    <div className='workout new container'>
      <h1>
        <span>Workout Goals</span>
        <span className='sep'></span>
        {goals.length > 0 ? <button className='start' onClick={startWorkout}>⏱️ Start!</button> : null}
      </h1>

      {goals.length > 0 ? (
        <table className='goals'>
          <thead><tr><td></td><th>Exercise</th><th>🪨 Resistance</th><th>🧮 Amount</th><th>⏲️ Duration</th><td></td></tr></thead>
          <tbody>{goals.map((goal, idx) => (
            <tr key={idx}>
              <td key='move'>{shuffle ? null : '☷'}</td>
              <td key='name'>{config.exercises[goal.id].name}</td>
              <Cell key='difficulty'
                    attr='difficulty'
                    goal={goal}
                    updateAll={updateAll}
                    update={update(idx)} />
              <Cell key='amount'
                    attr='amount'
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
        <label htmlFor='repeats'>Repeat</label>
        <input id='repeats' value={repeats} onChange={e => setRepeats(e.target.value)} />
        <label htmlFor='shuffle'>Shuffle</label>
        <span id='shuffle' className={`toggle ${shuffle ? 'toggled' : ''}`}
              onClick={() => setShuffle(s => !s)}></span>
      </>): null}

      <h2>Copy from another workout...</h2>
      <ul className='other-workouts'>{Object.keys(config.workouts).map(key => (
        config.workouts[key].length < 2 ? null : (
          <li key={key}>
            <button className='add' onClick={addFromWorkout(key)}>+</button>
            <span className='name'>{key}</span>
            {config.workouts[key].map(n => <span key={n} className='exercise'>{n}</span>)}
          </li>
        )))}</ul>

      <h2>Add individual exercises...</h2>
      <ul className='tags'>
        <li key='all'
            className={`tag ${activeTag ? '' : 'active'}`}
            onClick={() => activateTag(null)}>all</li>
        {Object.keys(config.tagToIds).sort().map(tag => (
          <li key={tag}
              className={`tag ${tag === activeTag ? 'active' : ''}`}
              onClick={() => activateTag(tag)}>{tag}</li>
        ))}
      </ul>
      <ul className='exercises'>{
        Object.values(config.exercises)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(ex => (activeTag === null || ex.tags.indexOf(activeTag) >= 0) ? (
                <li key={ex.id}>
                  <button className='add' onClick={add(ex.id)}>+</button>
                  <img src={`/static/img/${ex.image}`} />
                  <span className='name'>{ex.name}</span>
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
