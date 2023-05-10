import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import dwt from 'discrete-wavelets'
import useNoSleep from 'use-no-sleep'
import React, { Fragment, useEffect, useState } from 'react'
import { useHistory, useParams } from 'react-router-dom'

import { apiCreate, apiRead } from './api.jsx'
import { roundTenths, When } from './common.jsx'
import { useGeo } from './geo.jsx'

import './workout.styl'


const Workout = () => useParams().id === 'new' ? <New /> : <Existing />


const New = () => {
  const history = useHistory()
  const [config, setConfig] = useState(null)
  const [targets, setTargets] = useState([])
  const [shuffle, setShuffle] = useState(true)
  const [repeat, setRepeat] = useState(true)
  const [showWorkouts, setShowWorkouts] = useState(true)
  const [activeTag, setActiveTag] = useState('cardio')

  const start = () => apiCreate('workouts', {
    tags: ['workout'],
    goals: { targets: targets, shuffle: shuffle, repeat: repeat },
  }).then(res => history.push(`/workout/${res.id}/`))

  const addExercise = id => () => setTargets(cur => [ ...cur, { id: id } ])

  const addFromWorkout = key => () => {
    setTargets(cur => [
      ...cur,
      ...config.workouts[key].map(n => ({
        id: config.exercises[config.nameToId[n]].id,
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

  const updateExercise = (idx, attr) => value => setTargets(cur => [
    ...cur.slice(0, idx),
    { ...cur[idx], [attr]: value },
    ...cur.slice(idx + 1)
  ])

  useEffect(() => { apiRead('config').then(setConfig) }, [])

  useEffect(() => { if (config) { addExercise(4)(); addExercise(5)() } }, [config])

  if (!config) return null

  return (
    <div className='workout new container'>
      <h1>
        <span>Workout Goals</span>
        <span className='sep'></span>
        {targets.length > 0 ? <button className='start' onClick={start}>⏱️ Start!</button> : null}
      </h1>

      {targets.length > 1 ? (
        <>
          <span className={`toggle ${shuffle ? 'toggled' : ''}`}
                onClick={() => setShuffle(r => !r)}></span><span>Shuffle</span>
        </>) : null}

      {targets.length > 0 ? (
        <>
          <span className={`toggle ${repeat ? 'toggled' : ''}`}
                onClick={() => setRepeat(r => !r)}></span><span>Repeat</span>
        </>) : null}

      {targets.length > 0 ? (
        <table className='goals'>
          <thead>
            <tr><td></td><th>Exercise</th><th>Resistance</th><th>Reps</th><th>Duration</th><td></td></tr>
          </thead>
          <tbody>{targets.map((ex, i) => (
            <tr key={`${ex.id}-${i}`}>
              <td>{shuffle ? null : <span>☷</span>}</td>
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
                    format={value => value ? (dayjs.duration(1000 * value)
                                              .toISOString()
                                              .replace(/[PT]/g, '')
                                              .toLowerCase()
                                              .replace(/([ymdhm])/g, '$1 ')) : ''}
                    parse={value => dayjs.duration(
                      /^\d+$/.test(value)
                        ? `PT${value}S`
                        : `PT${value.replace(/ /g, '').toUpperCase()}`
                    ).as('s')}
                    update={updateExercise(i, 'duration_s')} />
              <td><button className='remove'
                          onClick={() => setTargets(cur => [
                            ...cur.slice(0, i),
                            ...cur.slice(i + 1),
                          ])}>×</button></td>
            </tr>))}
          </tbody>
        </table>) : null}

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
  return <td>{(
    isEditing
      ? <input autoFocus
               onFocus={e => e.target.select()}
               onBlur={e => { setIsEditing(false); update(p(e.target.value)) }}
               defaultValue={f(value)} />
      : <span onClick={() => setIsEditing(true)}>{value ? f(value) : '---'}</span>
  )}</td>
}


const Existing = () => {
  const id = useParams().id
  const history = useHistory()
  const [workout, setWorkout] = useState(null)

  useEffect(() => {
    apiRead(`workout/${id}`).then(setWorkout).catch(err => {
      console.log(err)
      history.replace('/')
    })
  }, [id])

  console.log(workout)

  return <div className='workout container'>{workout?.id}</div>
}


const formatTime = (s, long) => {
  if (s < 91 && !long) return `${roundTenths(s)}s`
  const secs = (s % 60 > 0) ? ` ${roundTenths(s % 60)}s` : ''
  if (s < 5401 && !long) return `${Math.floor(s / 60)}m` + secs
  const mins = `${Math.floor(s / 60)}m`
  return [`${Math.floor(s / 3600)}h`, mins, secs].join(' ')
}


const CompletedExercise = ({ exercise }) => {
  return <div className='exercise'>
    <h2 className='name'>{exercise.exercise}</h2>
    <div className='metrics'>
      <div className='meter'>
        <span className='label'>Duration</span>
        <span className='emoji'>⏱️</span>
        <span className='value'>{formatTime(exercise.duration_s)}</span>
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
}

const waveletEncode = (data, prune) => dwt.wavedec(data, 'haar').slice(0, prune).flat()

const waveletDecode = (coeffs, n) => {
  if (!coeffs || !n) return []
  const tree = [[coeffs.shift()]]
  n -= 1
  let i = 1
  while (coeffs.length > 0) {
    tree.push(coeffs.splice(0, i))
    n -= i
    i *= 2
  }
  while (n > 0) {
    tree.push(Array(i).fill(0, 0))
    n -= i
    i *= 2
  }
  return dwt.waverec(tree, 'haar').slice(0, n)
}

const CurrentExercise = ({ event, finished }) => {
  const ex = event.exercise
  const [stepCount, setStepCount] = useState(0)
  const [rrs, setRrs] = useState(waveletDecode(ex.rr_coeffs, ex.rr_count))
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
    ex.rr_coeffs = waveletEncode(rr, -3)
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

const SelectExercise = ({ span, workout, select, config }) => {
  const [index, setIndex] = useState(0)
  const [durationSec, setDurationSec] = useState(90)
  const current = config?.exercises[workout[index]]
  const youtube = current?.howto?.replace(/^https:..youtu.be./, '')
                                 .replace(/t=/, 'start=')

  useEffect(() => {
    setIndex(Math.floor(workout.length * Math.random()))
  }, [workout])

  return <div className='select-exercise'>
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
}

const SelectWorkout = ({ span, config, select }) => {
  return <div className='select-workout'>
    <h2>Add Exercises</h2>
    <div className='workouts'>{
      Object.keys(config.workouts).map(
        name => <div key={name} onClick={() => select(name)}>{name}</div>)
    }</div>
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
    <span className='value'>{formatTime(remainingSec, true)}</span>
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
    <span className='value'>{formatTime(elapsedSec, true)}</span>
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

// Compute mean, standard deviation, and rms values of an array. See Welford's
// online algorithm at https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance
const _stats = xs => {
  const count = xs.length
  const acc = xs.reduce((x, acc) => {
    const n = acc.n + 1
    const d1 = x - acc.m
    const m = acc.m + d1 / n
    const d2 = x - m
    return { n, m, m2: acc.m2 + d1 * d2, s2: acc.s2 + x * x }
  }, { n: 0, m: 0, m2: 0, s2: 0 })
  return {
    count: count,
    mean: acc.m,
    stdev: acc.m2 / count,
    rms: Math.sqrt(acc.s2 / count)
  }
}

// Return an array of sample differences from an array of values xs.
const _diff = xs => xs.map((x, i) => i ? x - xs[i - 1] : 0)

// Return the cumulative sum of an array.
const _cumsum = xs => xs.reduce((acc, x) => [...acc, acc.slice(-1) + x], [0])

// Heart rate variability metrics; see ncbi.nlm.nih.gov/pmc/articles/PMC5624990/
const sdrr = rrs => rrs.length < 2 ? 0.0 : _stats(rrs).stdev
const rmssd = rrs => rrs.length < 2 ? 0.0 : _stats(_diff(rrs)).rms

// Return heart rate in beats/min, at 1Hz samples.
const bpm = rrs => {
  let i = 0
  const elapsed = _cumsum(rrs)
  return Array.from({ length: elapsed.length }, (_, t) => {
    while (elapsed[i] <= t) i++
    // 60000 [msec / min] / rrs[msec / beat]
    const lo = 60000 / rrs[i - 1]
    const hi = 60000 / rrs[i]
    const a = (t - elapsed[i - 1]) / (elapsed[i] - elapsed[i - 1])
    return (1 - a) * lo + a * hi
  })
}

// Cumulative metabolic energy, computed from instantaneous heart rate
// measurements, over the course of the recording -- from Keytel et al. (2005
// https://ncbi.nlm.nih.gov/pubmed/15966347), see also Rennie et al. (2001
// https://ncbi.nlm.nih.gov/pubmed/11404659) & Hiilloskorpi et al. (1999
// https://thieme-connect.com/products/ejournals/html/10.1055/s-1999-8829)
const energy = (bpm, age, male, vo2max, weight) => {
  let intercept, slope
  if (vo2max && male) {
    slope = 0.6344
    intercept = -95.7735 + 0.3942 * weight + 0.4044 * vo2max + 0.2713 * age
  } else if (vo2max) {
    slope = 0.4498
    intercept = -59.3954 + 0.1032 * weight + 0.3802 * vo2max + 0.2735 * age
  } else if (male) {
    slope = 0.6309
    intercept = -55.0969 + 0.1988 * weight + 0.2017 * age
  } else {
    slope = 0.4472
    intercept = -20.4022 + -0.1263 * weight + 0.0740 * age
  }

  // The Keytel formula yields kj/min for each heart rate sample. We convert
  // [kj/min] / 60[sec/min] ==> [kj/sec] * 1000 [j/kj] ==> [j/sec]. Our samples
  // are spaced at 1/sec, so the sum gives us cumulative energy in joules.
  return _cumsum(bpm.map(x => (x * slope + intercept) * 1000 / 60))
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
    <span className='emoji'>🫀️️</span>
    <span className='value'>
      {rrs.length > 0 ? rrs.join('.') : '---'}
      {heartRate > 0 ? heartRate : '---'}
    </span>
  </div>
}

export { Workout }
