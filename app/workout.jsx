import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import useNoSleep from 'use-no-sleep'
import React, { useEffect, useState } from 'react'
import { useHistory, useParams } from 'react-router-dom'

import { apiCreate, apiRead } from './api.jsx'
import { Meter } from './common.jsx'
import lib from './lib.jsx'

import './workout.styl'


const NewWorkout = () => {
  const history = useHistory()
  const [config, setConfig] = useState(null)
  const [goals, setGoals] = useState([])
  const [defaults, setDefaults] = useState({})
  const [showWorkouts, setShowWorkouts] = useState(true)
  const [activeTag, setActiveTag] = useState('cardio')

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

  const thumbnail = ex => {
    if (!ex.howto) return null
    return '📺'
    const code = ex.howto.split('/')[3].split('?')[0]
    const src = `https://img.youtube.com/vi/${code}/maxresdefault.jpg`
    return <img src={src} />
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
  ).then(res => history.push(`/workout/${res.id}/`))

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
      <ul className='tags'>{Object.keys(config.tagToIds).sort().map(tag => (
        <li key={tag}
            className={`tag ${tag === activeTag ? 'active' : ''}`}
            onClick={() => setActiveTag(tag)}>{tag}</li>
      ))}
      </ul>
      <ul className='exercises'>{
        Object
          .values(config.exercises)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(ex => (
            ex.tags.filter(t => t === activeTag).length ? (
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


const ExistingWorkout = () => {
  const id = useParams().id
  const history = useHistory()
  const [config, setConfig] = useState(null)
  const [workout, setWorkout] = useState(null)

  useEffect(() => { apiRead(`config`).then(setConfig) }, [])
  useEffect(() => { apiRead(`workout/${id}`).then(setWorkout) }, [id])

  console.log(workout)

  if (!workout || !config) return null

  return (
    <div className='workout container'>
      <ul>{workout.goals.map((ex, i) => (
        <li className='goal' key={`${ex.id}-${i}`}>
          <span className='name'>{config.exercises[ex.id].name}</span>
          {ex.resistance ? `${ex.resistance}` : null}
          {ex.reps ? `${ex.reps}x` : null}
          {ex.duration_s ? `(${lib.formatDuration(ex.duration_s)})` : null}
          <button>⏱️ Start!</button>
        </li>
      ))}</ul>
    </div>
  )
}


const NextSet = ({ span, workout, select, config }) => {
  const [index, setIndex] = useState(0)
  const [durationSec, setDurationSec] = useState(90)
  const current = config?.exercises[workout[index]]
  const youtube = current?.howto?.replace(/^https:..youtu.be./, '')
                                 .replace(/t=/, 'start=')

  useEffect(() => {
    setIndex(Math.floor(workout.length * Math.random()))
  }, [workout])

  return (
    <div className='select-exercise'>
      <h2>
        <span className='up' onClick={
                () => setIndex(i => (i - 1) % workout.length)}>🡐</span>
        <span className='value' onClick={
                () => setIndex(Math.floor(Math.random() * workout.length))
              }>{workout[index]}</span>
        <span className='down' onClick={
                () => setIndex(i => (i + 1) % workout.length)}>🡒</span>
      </h2>
      {youtube
       ? <iframe width='420' height='315' frameBorder='0'
                 src={`https://www.youtube.com/embed/${youtube}`}></iframe>
       : null}
      <input type='number'
             value={durationSec}
             onChange={e => setDurationSec(parseInt(e.target.value))} />sec
      <button onClick={() => select(index, durationSec)}>Start!</button>
    </div>
  )
}


const CompletedSet = ({ es }) => (
  <div className='exercise-set'>
    <h2 className='name'>{es.exercise.name}</h2>
    <div className='metrics'>
      <div className='meter'>
        <span className='label'>Duration</span>
        <span className='emoji'>⏱️</span>
        <span className='value'>{lib.formatDuration(es.duration_s)}</span>
      </div>
      {!exercise.reps ? null :
       <Meter value={exercise.reps} attr='reps' label='Reps' emoji='🧮' />}
      {!exercise.resistance ? null :
       <Meter value={exercise.resistance} attr='resistance' label='Resistance'
              emoji='🪨' formats={{ '': null, lb: 1, kg: 1 }} />}
      {!exercise.distance_m ? null :
       <Meter value={exercise.distance_m} attr='distance_m' label='Distance'
              emoji='📍' formats={{ m: null, km: 0.001, mi: 0.0062137 }} />}
      {!exercise.cadence_hz ? null :
       <Meter value={exercise.cadence_hz} attr='cadence_hz' label='Cadence'
              emoji='🚲' formats={{ Hz: null, rpm: 60 }} />}
      {!exercise.avg_power_w ? null :
       <Meter value={exercise.avg_power_w} attr='avg_power_w' label='Average Power'
              emoji='⚡' formats={{ W: null, hp: 0.00134102 }} />}
    </div>
  </div>
)


const CurrentSet = ({ es, finished }) => {
  const ex = event.exercise
  const [stepCount, setStepCount] = useState(0)
  const [rrs, setRrs] = useState(lib.waveletDecode(ex.rr_coeffs, ex.rr_count))
  const remainingSec = dayjs.utc(event.utc)
                            .add(ex.duration_s, 's')
                            .diff(dayjs.utc(), 's')
  const [preventSleep, setPreventSleep] = useState(remainingSec > 0)
  const nosleep = useNoSleep(preventSleep)

  const timeFinished = () => {
    postTo(`events/${event.id}`, ex)
    setPreventSleep(false)
  }

  const fields = <>
    <label htmlFor='reps'>Reps</label>
    <input name='reps' type='number' autoFocus
           onChange={e => { ex.reps = parseInt(e.target.value) }} />
    <label htmlFor='resistance'>Resistance</label>
    <input name='resistance' type='number'
           onChange={e => { ex.resistance = parseFloat(e.target.value) }} />
    {ex.group !== 'cardio' ? null : <>
      <label htmlFor='distance_m'>Distance</label>
      <input name='distance_m' type='number' />
      <span className='unit'>m</span>
      <label htmlFor='cadence_hz'>Cadence</label>
      <input name='cadence_hz' type='number' />
      <span className='unit'>RPM</span>
      <label htmlFor='avg_power_w'>Average Power</label>
      <input name='avg_power_w' type='number' />
      <span className='unit'>W</span>
    </>}
    <button onClick={() => postTo(`events/${event.id}`, ex, finished)}>Done</button>
  </>

  const updateRrs = rr => {
    ex.rr_count = rr.length
    ex.rr_coeffs = lib.waveletEncode(rr, -3)
    setRrs(rr)
  }

  const updateStepCount = () => {
    ex.reps = (ex.reps || 0) + 1
    setStepCount(s => s + 1)
  }

  const meters = <>
    {ex.group === 'cardio'
      ? <Stopwatch durationSec={ex.duration_s - remainingSec} finished={timeFinished} />
      : <Timer durationSec={remainingSec} finished={timeFinished} />}
    {!navigator.bluetooth ? null : <HeartRate rrs={rrs} setRrs={updateRrs} />}
    {!window.Accelerometer ? null
      : <StepCounter stepCount={stepCount} setStepCount={updateStepCount} />}
  </>

  return <div className='exercise'>
    <h2 className='name'>Now: {ex.exercise}</h2>
    {remainingSec > 0 ? meters : fields}
  </div>
}


// A Timer counts down from a starting duration to zero.
const Timer = ({ durationSec, finished }) => {
  const [running, setRunning] = useState(true)
  const [remainingSec, setRemainingSec] = useState(durationSec)

  useEffect(() => {
    if (running) {
      const interval = setInterval(() => setRemainingSec(s => s - 0.1), 100)
      return () => clearInterval(interval)
    }
  }, [running])

  useEffect(() => {
    if (remainingSec <= 0) {
      setRunning(false)
      finished()
    }
  }, [remainingSec])

  return <div className='timer'
              onClick={() => setRunning(on => !on)}
              onDoubleClick={() => setRemainingSec(durationSec)}>
    <span className='emoji'>⏲️</span>
    <span className='value'>{lib.formatDuration(remainingSec)}</span>
  </div>
}


// A Stopwatch counts seconds since the watch was started.
const Stopwatch = ({ durationSec, finished }) => {
  const [running, setRunning] = useState(true)
  const [elapsedSec, setElapsedSec] = useState(durationSec)

  useEffect(() => {
    if (running) {
      const interval = setInterval(() => setElapsedSec(s => s + 0.1), 100)
      return () => clearInterval(interval)
    }
  }, [running])

  useEffect(() => {
    if (elapsedSec >= durationSec) {
      setRunning(false)
      finished()
    }
  }, [elapsedSec])

  return <div className='stopwatch'
              onClick={() => setRunning(on => !on)}
              onDoubleClick={() => setElapsedSec(0)}>
    <span className='emoji'>⏱️</span>
    <span className='value'>{lib.formatDuration(elapsedSec)}</span>
  </div>
}


const StepCounter = ({ stepCount, setStepCount }) => {
  const acc = new window.Accelerometer({ frequency: 1, referenceFrame: 'device' })
  const [enabled, setEnabled] = useState(false)
  const [readings, setReadings] = useState([])

  useEffect(() => {
    console.log('accelerometer is', enabled ? 'enabled' : 'disabled')
    if (enabled) {
      const handler = () => setReadings(arr => {
        const { x, y, z } = acc
        const logMag = Math.log(x * x + y * y + z * z) / 2
        return [...(arr.length > 99 ? arr.slice(1) : arr), logMag]
      })
      acc.addEventListener('reading', handler)
      acc.addEventListener('error', console.log)
      acc.start()
      return () => {
        acc.stop()
        acc.removeEventListener('error', console.log)
        acc.removeEventListener('reading', handler)
      }
    }
  }, [enabled])

  useEffect(() => {
    setStepCount(sc => sc + 1)
  }, [readings])

  return <div className='step-counter' onClick={() => setEnabled(on => !on)}>
    <span className='emoji'>👟</span>
    <span className='value'>{stepCount}</span>
  </div>
}


const parseHeartRate = data => {
  const flags = data.getUint8(0)
  const result = {}
  let index = 1
  if (flags & 0x01) {
    result.heartRate = data.getUint16(index, /* littleEndian= */true)
    index += 2
  } else {
    result.heartRate = data.getUint8(index)
    index += 1
  }
  if (flags & 0x04) {
    result.contact = !!(flags & 0x02)
  }
  if (flags & 0x08) {
    result.energy = data.getUint16(index, /* littleEndian= */true)
    index += 2
  }
  if (flags & 0x10) {
    result.rr = []
    for (; index + 1 < data.byteLength; index += 2) {
      result.rr.push(data.getUint16(index, /* littleEndian= */true))
    }
  }
  return result
}

const HeartRate = ({ rrs, setRrs }) => {
  const [enabled, setEnabled] = useState(false)
  const [bluetoothDevice, setBluetoothDevice] = useState(null)
  const [heartRateMonitor, setHeartRateMonitor] = useState(null)
  const [heartRate, setHeartRate] = useState(0)

  useEffect(() => {
    console.log('heart rate monitor is', enabled ? 'enabled' : 'disabled')
    if (enabled) {
      navigator.bluetooth
        .requestDevice({ filters: [{ services: ['heart_rate'] }] })
        .then(device => setBluetoothDevice(device))
        .catch(console.log)
      return () => setBluetoothDevice(null)
    }
  }, [enabled])

  useEffect(() => {
    if (bluetoothDevice) {
      bluetoothDevice
        .gatt.connect()
        .then(server => server.getPrimaryService('heart_rate'))
        .then(service => service.getCharacteristic('heart_rate_measurement'))
        .then(char => setHeartRateMonitor(char))
        .catch(console.log)
      return () => setHeartRateMonitor(null)
    }
  }, [bluetoothDevice])

  useEffect(() => {
    if (heartRateMonitor) {
      const sample = e => {
        const data = parseHeartRate(e.target.value)
        setRrs(rr => [...rr, data.rr])
        setHeartRate(data.heartRate)
      }
      heartRateMonitor.addEventListener('characteristicvaluechanged', sample)
      heartRateMonitor.startNotifications()
      return () => {
        heartRateMonitor.stopNotifications()
        heartRateMonitor.removeEventListener('characteristicvaluechanged', sample)
      }
    }
  }, [heartRateMonitor])

  return <div className='heart-rate' onClick={() => setEnabled(on => !on)}>
    <span className='emoji'>💗</span>
    <span className='value'>
      {rrs.length > 0 ? rrs.join('.') : '---'}
      {heartRate > 0 ? heartRate : '---'}
    </span>
  </div>
}


const Workout = () => useParams().id === 'new' ? <NewWorkout /> : <ExistingWorkout />


export { Workout }
