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
import { NewWorkout } from './new-workout.jsx'

import './workout.styl'


const ExistingWorkout = () => {
  const id = parseInt(useParams().id, 36)
  const history = useHistory()
  const [config, setConfig] = useState(null)
  const [workout, setWorkout] = useState(null)
  const [activeSet, setActiveSet] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => { apiRead(`config`).then(setConfig) }, [])
  useEffect(() => { apiRead(`workout/${id}`).then(setWorkout) }, [id])
  useEffect(() => {
    if (!workout) return
    setSelected(workout.sets.length % workout.goals.length)
    const active = workout.sets.filter(es => !es.end_utc)
    if (active.length) setActiveSet(active[0])
  }, [workout])

  if (!workout || !config || selected === null) return null

  const completedExercises = workout.sets.map(es => es.exercise_id)
  const goal = workout.goals[selected]

  return (
    <div className='workout container'>
      {!navigator.bluetooth ? null : <HeartRate />}
      {!window.Accelerometer ? null : <StepCounter />}
      {activeSet ? <ActiveSet workout={workout} es={activeSet} /> : (<>
        <h1 className='next'>
          <select value={selected} onChange={e => setSelected(e.target.value)}>{
            workout.goals.map((goal, i) => (
              <option key={i} value={i}>{config.exercises[goal.id].name}</option>
            ))
          }</select>
          <button className='start' onClick={() => apiCreate(`workout/${id}/sets`, { exercise_id: goal.id }).then(setActiveSet)}>⏱️ Start!</button>
        </h1>
        <div className='goal'>
          Goals:
          {goal.resistance ? `🪨 ${goal.resistance}` : null}
          {goal.reps ? `🧮 ${goal.reps}` : null}
          {goal.duration_s ? `⏲️ ${lib.formatDuration(goal.duration_s)}` : null}
          <img src={`/static/img/${config.exercises[goal.id].image}`} />
        </div>
      </>)}
      {workout.sets.length ? (<>
        <h2>Completed</h2>
        <ul>{workout.sets.map(es => es.end_utc ? <CompletedSet key={es.id} set={es} /> : null)}</ul>
      </>) : null}
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
        <span className='value'>{lib.formatDuration(es.end_utc - es.start_utc)}</span>
      </div>
      {es.reps ? <Meter value={es.reps} attr='reps' label='Reps' emoji='🧮' /> : null}
      {es.resistance ? <Meter value={es.resistance} attr='resistance' label='Resistance'
                              emoji='🪨' formats={{ '': null, lb: 1, kg: 1 }} /> : null}
      {es.distance_m ? <Meter value={es.distance_m} attr='distance_m' label='Distance'
                              emoji='📍' formats={{ m: null, km: 0.001, mi: 0.0062137 }} /> : null}
      {es.cadence_hz ? <Meter value={es.cadence_hz} attr='cadence_hz' label='Cadence'
                              emoji='🚲' formats={{ Hz: null, rpm: 60 }} /> : null}
      {es.avg_power_w ? <Meter value={es.avg_power_w} attr='avg_power_w' label='Average Power'
                               emoji='⚡' formats={{ W: null, hp: 0.00134102 }} /> : null}
    </div>
  </div>
)


const ActiveSet = ({ workout, es, goals }) => {
  const [stepCount, setStepCount] = useState(0)
  const [rrs, setRrs] = useState(lib.waveletDecode(es.rr_coeffs, es.rr_count))
  const remainingSec = dayjs.utc() - es.start_utc
  const [preventSleep, setPreventSleep] = useState(remainingSec > 0)
  const nosleep = useNoSleep(preventSleep)

  const timeFinished = () => {
    postTo(`events/${event.id}`, ex)
    setPreventSleep(false)
  }

  const fields = <>
    <label htmlFor='reps'>Reps</label>
    <input name='reps' type='number' autoFocus
           onChange={e => { es.reps = parseInt(e.target.value) }} />
    <label htmlFor='resistance'>Resistance</label>
    <input name='resistance' type='number'
           onChange={e => { es.resistance = parseFloat(e.target.value) }} />
    {es.group !== 'cardio' ? null : <>
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

  const meters = <>
    {es.group === 'cardio'
      ? <Stopwatch durationSec={remainingSec} finished={timeFinished} />
      : <Timer durationSec={remainingSec} finished={timeFinished} />}
  </>

  return <div className='exercise'>
    <h2 className='name'>Now: {es.exercise}</h2>
    {remainingSec > 0 ? meters : fields}
  </div>
}


// A Timer counts down from a starting duration to zero.
const Timer = ({ seconds, finished }) => {
  const [running, setRunning] = useState(true)
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (running) {
      const interval = setInterval(() => setRemaining(s => s - 0.1), 100)
      return () => clearInterval(interval)
    }
  }, [running])

  useEffect(() => {
    if (remaining <= 0) {
      setRunning(false)
      finished()
    }
  }, [remaining])

  return <div className='timer'
              onClick={() => setRunning(on => !on)}
              onDoubleClick={() => setRemaining(seconds)}>
    <span className='emoji'>⏲️</span>
    <span className='value'>{lib.formatDuration(remaining)}</span>
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


const StepCounter = () => {
  const g = 9.81
  const freqHz = 31
  const halflifeSec = 0.5
  const mix = Math.exp(-Math.log(2) / (freqHz * halflifeSec))

  const [enabled, setEnabled] = useState(false)
  const [state, setState] = useState(g)
  const [stepCount, setStepCount] = useState(0)

  useEffect(() => {
    console.log('accelerometer is', enabled ? 'enabled' : 'disabled')
    if (!enabled) return
    const acc = new window.Accelerometer({ frequency: freqHz, referenceFrame: 'device' })
    const handler = () => {
      const { x, y, z } = acc
      const mag = Math.sqrt(x * x + y * y + z * z)
      setState(s => {
        const t = mix * s + (1 - mix) * mag
        if (s < g && t > g + 0.1) setStepCount(c => c + 1)
        return t
      })
    }
    acc.addEventListener('reading', handler)
    acc.addEventListener('error', console.log)
    acc.start()
    return () => {
      acc.stop()
      acc.removeEventListener('error', console.log)
      acc.removeEventListener('reading', handler)
    }
  }, [enabled])

  return (
    <div className={`step-counter ${enabled ? 'enabled' : 'disabled'}`}
         onClick={() => setEnabled(on => !on)}
         onDoubleClick={() => setStepCount(0)}>
      <span className='emoji'>👟</span>
      <span className='value'>{stepCount}</span>
    </div>
  )
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
    result.rrs = []
    for (; index + 1 < data.byteLength; index += 2) {
      result.rrs.push(data.getUint16(index, /* littleEndian= */true))
    }
  }
  return result
}


const HeartRate = () => {
  const [enabled, setEnabled] = useState(false)
  const [bluetoothDevice, setBluetoothDevice] = useState(null)
  const [heartRateMonitor, setHeartRateMonitor] = useState(null)

  const [rrs, setRrs] = useState([])
  const [heartRate, setHeartRate] = useState(0)

  useEffect(() => {
    console.log('heart rate monitor is', enabled ? 'enabled' : 'disabled')
    if (!enabled) return
    navigator.bluetooth
      .requestDevice({ filters: [{ services: ['heart_rate'] }] })
      .then(device => setBluetoothDevice(device))
      .catch(console.log)
    return () => setBluetoothDevice(null)
  }, [enabled])

  useEffect(() => {
    if (!bluetoothDevice) return
    bluetoothDevice
      .gatt.connect()
      .then(server => server.getPrimaryService('heart_rate'))
      .then(service => service.getCharacteristic('heart_rate_measurement'))
      .then(hrm => setHeartRateMonitor(hrm))
      .catch(console.log)
    return () => setHeartRateMonitor(null)
  }, [bluetoothDevice])

  useEffect(() => {
    if (!heartRateMonitor) return
    const sample = e => {
      const data = parseHeartRate(e.target.value)
      if (data.rrs) setRrs(rrs => [...rrs, ...data.rrs])
      if (data.heartRate) setHeartRate(data.heartRate)
    }
    heartRateMonitor.addEventListener('characteristicvaluechanged', sample)
    heartRateMonitor.startNotifications()
    return () => {
      heartRateMonitor.stopNotifications()
      heartRateMonitor.removeEventListener('characteristicvaluechanged', sample)
    }
  }, [heartRateMonitor])

  return (
    <div className={`heart-rate ${enabled ? 'enabled' : 'disabled'}`}
         onDoubleClick={() => { setRrs([]); setHeartRate(0) }}
         onClick={() => setEnabled(on => !on)}>
      <span className='emoji'>💗</span>
      <span className='value'>{heartRate > 0 ? heartRate : '---'}</span>
    </div>
  )
}


const Workout = () => useParams().id === 'new' ? <NewWorkout /> : <ExistingWorkout />


export { Workout }
