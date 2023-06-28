import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import useNoSleep from 'use-no-sleep'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiCreate, apiRead, apiUpdate } from './api.jsx'
import { ConfigContext, Meter } from './common.jsx'
import { geoToUtmConverter, getUtmZone, useGeo } from './geo.jsx'
import lib from './lib.jsx'

import alarmSound from './alarm.mp3'

import './workout.styl'


const sumDistance = ({ acc, prev }, geo) => {
  const { latitude: lat, longitude: lng } = geo.coords
  const [e, n] = geoToUtmConverter(getUtmZone(geo))([lng, lat])
  if (!prev) return { acc: 0, prev: [e, n] }
  const [pe, pn] = prev
  const [de, dn] = [e - pe, n - pn]
  return { acc: acc + Math.sqrt(de * de + dn * dn), prev: [e, n] }
}


const Workout = () => {
  const id = parseInt(useParams().id, 36)
  const config = useContext(ConfigContext)

  const [workout, setWorkout] = useState(null)

  const reload = () => {
    setWorkout(null)
    apiRead(`workout/${id}`).then(setWorkout)
  }

  useEffect(() => { reload() }, [id])

  if (!workout || !config) return null

  const completedSets = workout.sets.filter(es => es.end_utc)
  const remainingSets = workout.sets.filter(es => !es.end_utc)

  console.log(completedSets.length, 'completed', remainingSets.length, 'remaining')

  return (
    <div className='workout container'>
      {remainingSets.length ? <ActiveSet workout={workout} refresh={reload} /> : null}
      {completedSets.length ? completedSets.sort((a, b) => b.end_utc - a.end_utc).map(
        set => <CompletedSet key={set.id} workout={workout} set={set} />
      ) : null}
    </div>
  )
}


const CompletedSet = ({ workout, set }) => {
  const config = useContext(ConfigContext)

  return config && (
    <div className='completed-set'>
      <h2 className='name'>{config.exercises[set.exercise_id].name}</h2>
      <span className='finished'>{dayjs.unix(set.end_utc).fromNow()}</span>
      <div className='metrics'>
        <Meter value={lib.formatDuration(set.end_utc - set.start_utc)} label='Duration' emoji='⏱️' />
        {set.reps ? <Meter value={set.reps} attr='reps' label='Reps' emoji='🧮' /> : null}
        {set.resistance ? <Meter value={set.resistance} attr='resistance' label='Resistance'
                                emoji='🪨' formats={{ '': null, lb: 1, kg: 1 }} /> : null}
        {set.distance_m ? <Meter value={set.distance_m} attr='distance_m' label='Distance'
                                emoji='📍' formats={{ m: null, km: 0.001, mi: 0.0062137 }} /> : null}
        {set.cadence_hz ? <Meter value={set.cadence_hz} attr='cadence_hz' label='Cadence'
                                emoji='🚲' formats={{ Hz: null, rpm: 60 }} /> : null}
        {set.avg_power_w ? <Meter value={set.avg_power_w} attr='avg_power_w' label='Average Power'
                                 emoji='⚡' formats={{ W: null, hp: 0.00134102 }} /> : null}
      </div>
    </div>
  )
}


const ActiveSet = ({ workout, refresh }) => {
  const config = useContext(ConfigContext)

  const [set, setSet] = useState(workout.sets.filter(es => !es.end_utc)[0])
  const [nosleep, setNosleep] = useState(set.start_utc && !set.end_utc)
  const awake = useNoSleep(nosleep)

  const [stepTimes, setStepTimes] = useState([])
  const [geoMeasurements, setGeoMeasurements] = useState([])
  const [heartRateMeasurements, setHeartRateMeasurements] = useState([])

  const post = data => apiUpdate(`workout/${workout.id}/set/${set.id}`, data).then(setSet)
  const start = () => { post({ start_utc: dayjs().unix() }); setNosleep(true) }
  const finish = () => { post({ end_utc: dayjs().unix() }); setNosleep(false) }

  const finalize = () => {
    const data = {}
    Object.keys(set).forEach(attr => { if (set[attr] != null) data[attr] = set[attr] })
    if (stepTimes.length) {
      data['step_count'] = stepTimes.length
      data['step_intervals'] = lib.waveletEncode(lib.diff(stepTimes))
    }
    if (geoMeasurements.length) {
      data['gps_count'] = geoMeasurements.length
      data['gps_lats'] = lib.waveletEncode(geoMeasurements.map(g => g.coords.latitude))
      data['gps_lngs'] = lib.waveletEncode(geoMeasurements.map(g => g.coords.longitude))
      data['gps_alts'] = lib.waveletEncode(geoMeasurements.map(g => g.coords.altitude))
      data['gps_times'] = lib.waveletEncode(geoMeasurements.map(g => g.timestamp))
    }
    if (heartRateMeasurements.length) {
      const rrs = []
      heartRateMeasurements.forEach(hr => rrs.push(...hr.rrs))
      data['rr_count'] = rrs.length
      data['rr_intervals'] = lib.waveletEncode(rrs)
    }
    post(data)
    refresh()
  }

  const update = attr => e => {
    const value = e.target.value
    setSet(es => ({ ...es, [attr]: value }))
  }

  return config && (
    <div className='active-set'>
      {navigator.bluetooth &&
       <HeartRateMonitor
         heartRate={heartRateMeasurements.length && heartRateMeasurements.slice(-1)[0].heartRate}
         addMeasurement={m => setHeartRateMeasurements(c => [...c, m])}
         clear={() => setHeartRateMeasurements([])} />}
      {window.Accelerometer &&
       <StepCounter
         stepCount={stepTimes.length}
         increment={() => setStepTimes(c => [...c, dayjs.utc().unix()])}
         clear={() => setStepTimes([])}
         sampleFrequencyHz={31} />}
      {navigator.geolocation &&
       <PathTracker
         recent={geoMeasurements.length && geoMeasurements.slice(-1)[0]}
         distance={geoMeasurements.reduce(sumDistance, { acc: 0 }).acc}
         addMeasurement={m => setGeoMeasurements(c => [...c, m])}
         clear={() => setGeoMeasurements([])}
         samplePeriodSec={60} />}

      <h1 className='name'>
        {set.start_utc ? null : <button className='start' onClick={start}>⏱️ Start!</button>}
        {config.exercises[set.exercise_id].name}
      </h1>

      {set.end_utc ? (
        <div className='finalize'>
          Reps<input name='reps' value={set.reps || set.target_amount || ''} type='number' onChange={update('reps')} autoFocus /><br />
          Resistance<input name='resistance' value={set.resistance || set.target_difficulty || ''} onChange={update('resistance')} type='number' /><br />
          Distance<input name='distance_m' value={set.distance_m || set.target_amount || ''} onChange={update('distance_m')} type='number' /><span className='unit'>m</span><br />
          Cadence<input name='cadence_hz' value={set.cadence_hz || ''} onChange={update('cadence_hz')} type='number' /><span className='unit'>RPM</span><br />
          Average Power<input name='avg_power_w' value={set.avg_power_w || ''} onChange={update('avg_power_w')} type='number' /><span className='unit'>W</span>
          <button className='save' onClick={finalize}>Save</button>
        </div>
      ) : set.start_utc ? (
        set.target_duration_s
          ? <Timer seconds={set.target_duration_s} finish={finish} />
          : <Stopwatch utc={set.start_utc} finish={finish} />
      ) : (
        <div className='info'>
          <img src={`/static/img/${config.exercises[set.exercise_id].image}`} />
          <div className='targets'>
            {set.target_difficulty ? <span className='difficulty'>Target difficulty: 🪨 {set.target_difficulty}</span> : null}
            {set.target_amount ? <span className='amount'>Target amount: 🧮 {set.target_amount}</span> : null}
            {set.target_duration_s ? <span className='duration_s'>Target duration: ⏲️  {lib.formatDuration(set.target_duration_s)}</span> : null}
          </div>
        </div>
      )}
    </div>
  )
}


// A Timer counts down from a starting duration to zero.
const Timer = ({ seconds, finish }) => {
  const alarm = useRef(new Audio(alarmSound))

  const [remaining, setRemaining] = useState(seconds)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setRemaining(s => s - 0.1), 100)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (remaining > 0) return
    if (finished) return
    setFinished(true)
    alarm.current.play()
    finish()
  }, [remaining, finished])

  return (
    <div className='timer'>
      <span className='emoji'>⏲️</span>
      <span className='value'>{lib.formatDuration(remaining)}</span>
    </div>
  )
}


// A Stopwatch counts seconds since the watch was started.
const Stopwatch = ({ utc, finish }) => {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(dayjs().unix() - utc), 100)
    return () => clearInterval(id)
  }, [])

  return (
    <div className='stopwatch'>
      <button className='finish' onClick={finish}>Finish</button>
      <span className='emoji'>⏱️</span>
      <span className='value'>{lib.formatDuration(elapsed)}</span>
    </div>
  )
}


const StepCounter = ({ stepCount, increment, clear, sampleFrequencyHz }) => {
  const g = 9.81
  const smoothingHalflifeSec = 0.5
  const mix = Math.exp(-Math.log(2) / (sampleFrequencyHz * smoothingHalflifeSec))
  const walkFrequencyHz = 2

  const [enabled, setEnabled] = useState(false)
  const [ema, setEma] = useState(g)
  const [debounce, setDebounce] = useState(0)

  useEffect(() => {
    console.log('accelerometer is', enabled ? 'enabled' : 'disabled')

    if (!enabled) return

    const acc = new window.Accelerometer({
      frequency: sampleFrequencyHz,
      referenceFrame: 'device',
    })

    const handler = () => {
      const { x, y, z } = acc
      const mag = Math.sqrt(x * x + y * y + z * z)
      setEma(prev => {
        const next = mix * prev + (1 - mix) * mag
        if (debounce > 0) {
          setDebounce(d => d - 1)
        } else if (prev < g && next > g + 0.1) {
          increment()
          setDebounce(0.7 * sampleFrequencyHz / walkFrequencyHz)
        }
        return next
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
         onDoubleClick={clear}>
      <span className='emoji'>👟</span>
      <span className='value'>{stepCount || '---'}</span>
    </div>
  )
}


const parseHeartRate = data => {
  const flags = data.getUint8(0)
  const result = {utc: dayjs().unix()}
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


const HeartRateMonitor = ({ heartRate, addMeasurement, clear }) => {
  const [enabled, setEnabled] = useState(false)
  const [bluetoothDevice, setBluetoothDevice] = useState(null)
  const [heartRateMonitor, setHeartRateMonitor] = useState(null)

  useEffect(() => {
    console.log('heart rate monitor is', enabled ? 'enabled' : 'disabled')

    if (!enabled) return

    navigator.bluetooth
      .requestDevice({ filters: [{ services: ['heart_rate'] }] })
      .then(setBluetoothDevice)
      .catch(e => {
        console.log(e.message)
        setEnabled(false)
      })

    return () => setBluetoothDevice(null)
  }, [enabled])

  useEffect(() => {
    if (!bluetoothDevice) return

    bluetoothDevice
      .gatt.connect()
      .then(server => server.getPrimaryService('heart_rate'))
      .then(service => service.getCharacteristic('heart_rate_measurement'))
      .then(setHeartRateMonitor)
      .catch(e => {
        console.log(e.message)
        setEnabled(false)
      })

    return () => setHeartRateMonitor(null)
  }, [bluetoothDevice])

  useEffect(() => {
    if (!heartRateMonitor) return

    const sample = e => addMeasurement(parseHeartRate(e.target.value))

    heartRateMonitor.addEventListener('characteristicvaluechanged', sample)
    heartRateMonitor.startNotifications()

    return () => {
      heartRateMonitor.stopNotifications()
      heartRateMonitor.removeEventListener('characteristicvaluechanged', sample)
    }
  }, [heartRateMonitor])

  return (
    <div className={`heart-rate-monitor ${enabled ? 'enabled' : 'disabled'}`}
         onDoubleClick={clear}
         onClick={() => setEnabled(on => !on)}>
      <span className='emoji'>💗</span>
      <span className='value'>{heartRate || '---'}</span>
    </div>
  )
}


const PathTracker = ({ recent, distance, addMeasurement, clear, samplePeriodSec }) => {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    console.log('geo tracker is', enabled ? 'enabled' : 'disabled')

    if (!enabled) return

    useGeo().then(addMeasurement).catch(() => setEnabled(false))

    const handle = setInterval(() => useGeo({
      timeout: 800 * samplePeriodSec,
      maximumAge: 2000 * samplePeriodSec,
      enableHighAccuracy: true,
    }).then(addMeasurement)
      .catch(e => {
        console.log(e.message)
        setEnabled(false)
      }), 1000 * samplePeriodSec)

    return () => clearInterval(handle)
  }, [enabled])

  return (
    <div className={`path-tracker ${enabled ? 'enabled' : 'disabled'}`}
         onDoubleClick={clear}
         onClick={() => setEnabled(on => !on)}>
      <span className='emoji'>🗺️</span>
      <span className='value'>{recent ? `${lib.formatDegrees(recent.coords.latitude)}, ${lib.formatDegrees(recent.coords.longitude)}` : '---'}</span>
      <span className='distance'>{`${distance} m`}</span>
    </div>
  )
}


export { Workout }
