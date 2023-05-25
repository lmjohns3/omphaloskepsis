import React, { useEffect, useState } from 'react'
import { useHistory, useParams } from 'react-router-dom'

import { apiCreate, apiRead } from './api.jsx'


const NewWorkout = () => {
  const history = useHistory()
  const [config, setConfig] = useState(null)
  const [goals, setGoals] = useState([])
  const [defaults, setDefaults] = useState({})
  const [showWorkouts, setShowWorkouts] = useState(true)
  const [activeTag, activateTag] = useState(null)

  useEffect(() => { apiRead('config').then(setConfig) }, [])

  if (!config) return null

  const addExercise = id => () => setGoals(cur => [ ...cur, { id: id, ...defaults } ])

  const addFromWorkout = key => () => {
    setGoals(cur => [
      ...cur,
      ...config.workouts[key].map(n => ({
        id: config.exercises[config.nameToId[n]].id,
        ...defaults,
      }))
    ])
    setShowWorkouts(false)
  }

  const updateDefault = attr => value => {
    if (value) setGoals(cur => cur.map(goal => ({ ...goal, [attr]: value })))
    setDefaults(cur => {
      if (value) cur[attr] = value
      else delete cur[attr]
      return { ...cur }
    })
  }

  const updateExercise = (idx, attr) => value => setGoals(cur => [
    ...cur.slice(0, idx),
    { ...cur[idx], [attr]: value },
    ...cur.slice(idx + 1)
  ])

  const startWorkout = () => apiCreate(
    'workouts', { tags: ['workout'], goals }
  ).then(res => history.push(`/workout/${res.id.toString(36)}/`))

  return (
    <div className='workout new container'>
      <h1>
        <span>Workout Goals</span>
        <span className='sep'></span>
        {goals.length > 0 ? <button className='start' onClick={startWorkout}>⏱️ Start!</button> : null}
      </h1>

      <table className='goals'>
        <thead><tr><th>Exercise</th><th>Resistance</th><th>Reps</th><th>Duration</th><td></td></tr></thead>
        <tbody>{goals.map((ex, i) => (
          <tr key={`${ex.id}-${i}`}>
            <td>{config.exercises[ex.id].name}</td>
            <Cell key='resistance'
                  value={ex.resistance}
                  update={updateExercise(i, 'resistance')} />
            <Cell key='reps'
                  value={ex.reps}
                  parse={parseInt}
                  update={updateExercise(i, 'reps')} />
            <Cell key='duration_s'
                  value={ex.duration_s}
                  format={value => value ? lib.formatDuration(value) : ''}
                  parse={lib.parseDuration}
                  update={updateExercise(i, 'duration_s')} />
            <td><button className='remove'
                        onClick={() => setGoals(cur => [
                          ...cur.slice(0, i),
                          ...cur.slice(i + 1),
                        ])}>×</button></td>
          </tr>))}
          <tr className='defaults'>
            <td>Defaults</td>
            <Cell key='resistance'
                  value={defaults.resistance}
                  update={updateDefault('resistance')} />
            <Cell key='reps'
                  value={defaults.reps}
                  parse={parseInt}
                  update={updateDefault('reps')} />
            <Cell key='duration_s'
                  value={defaults.duration_s}
                  format={lib.formatDuration}
                  parse={lib.parseDuration}
                  update={updateDefault('duration_s')} />
          <td></td></tr>
        </tbody>
      </table>

      {showWorkouts ? (<>
        <h2>Copy from another workout...</h2>
        <ul className='other-workouts'>{Object.keys(config.workouts).map(key => (
          config.workouts[key].length < 2 ? null : (
            <li key={key}>
              <button className='add' onClick={addFromWorkout(key)}>+</button>
              <span className='name'>{key}</span>
              {config.workouts[key].map(n => <span key={n} className='exercise'>{n}</span>)}
            </li>
          )))}</ul>
      </>) : null}

      <h2>Add individual exercises...</h2>
      <ul className='tags'>
        <li key='all'
            className={`tag ${activeTag ? '' : 'active'}`}
            onClick={() => activateTag(null)}>All</li>
        {Object.keys(config.tagToIds).sort().map(tag => (
          <li key={tag}
              className={`tag ${tag === activeTag ? 'active' : ''}`}
              onClick={() => activateTag(tag)}>{tag}</li>
        ))}
      </ul>
      <ul className='exercises'>{
        Object
          .values(config.exercises)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(ex => (
            ex.tags.filter(t => t === activeTag).length + (activeTag === null) ? (
              <li key={ex.id}>
                <button className='add' onClick={addExercise(ex.id)}>+</button>
                <span className='name'>{ex.name}</span>
              </li>
            ) : null))}</ul>
    </div>
  )
}


const Cell = ({ value, format, parse, update }) => {
  const [isEditing, setIsEditing] = useState(false)
  const f = format ? format : (v => v)
  const p = parse ? parse : (v => v)
  return <td>{isEditing ? (
    <input autoFocus
           onFocus={e => e.target.select()}
           onBlur={e => { setIsEditing(false); update(p(e.target.value)) }}
           defaultValue={f(value)} />
  ) : (
    <span onClick={() => setIsEditing(true)}>{value ? f(value) : '---'}</span>
  )}</td>
}


export { NewWorkout }
