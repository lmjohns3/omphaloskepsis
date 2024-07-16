import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import useNoSleep from 'use-no-sleep'
import { useLiveQuery } from 'dexie-react-hooks'
import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Meter, METRICS } from './common.jsx'
import { db, createSnapshot } from './db.jsx'
import { geoToUtmConverter, getUtmZone, useGeo } from './geo.jsx'
import lib from './lib.jsx'

import alarmSound from './alarm.mp3'

import './workout.styl'


export default () => {
  const id = +useParams().id
  const exercises = useLiveQuery(() => db.exercises.where({ 'workout.id': id }).toArray(), [id])
  const snapshots = useLiveQuery(() => db.snapshots.where({ 'workout.id': id }).toArray(), [id])

  if (!exercises || !snapshots) return null

  const isComplete = snapshots.length === exercises.length
  const totalDuration = lib.sum((snapshots || []).map(s => (s.exercise?.duration_s || 0)))

  return (
    <div key={id} className='workout'>
      <h2>{isComplete ? 'Workout Complete!' : 'Current Workout: ' + '▪'.repeat(snapshots.length) + '▫'.repeat(exercises.length - snapshots.length)}</h2>
      {isComplete ? null : <ActiveSet key={snapshots.length} goal={exercises[snapshots.length]} />}
      {snapshots.reverse().map(s =>
        <div key={s.id} className='completed-set'>
          <h3 className='exercise-name'>{s.exercise.name}</h3>
          {METRICS.exercise.map(m => m.attr in s.exercise && <Meter key={m.attr}
                                                                    value={s.exercise[m.attr]}
                                                                    target={exercises.find(e => e.id === s.exercise.id)[m.attr]}
                                                                    {...m} />)}
        </div>
      )}
    </div>
  )
}


const ActiveSet = ({ goal }) => {
  const [utc, setUtc] = useState(0)
  const [fields, setFields] = useState({ ...goal })
  const [nosleep, setNosleep] = useState(false)
  const awake = useNoSleep(nosleep)

  const [stepTimes, setStepTimes] = useState([])
  const [geoMeasurements, setGeoMeasurements] = useState([])
  const [heartRateMeasurements, setHeartRateMeasurements] = useState([])

  const start = () => { setUtc(dayjs.utc().unix()); setNosleep(true) }

  const finish = () => {
    setNosleep(false)
    setFields(d => ({ ...d, duration_s: dayjs.utc().unix() - utc}))
  }

  const update = attr => value => setFields(d => ({ ...d, [attr]: value }))

  const commit = () => {
    if (stepTimes.length) {
      fields['stepCount'] = stepTimes.length
      fields['stepIntervals'] = lib.waveletEncode(lib.diff(stepTimes))
    }
    if (geoMeasurements.length) {
      fields['gpsCount'] = geoMeasurements.length
      fields['gpsLats'] = lib.waveletEncode(geoMeasurements.map(g => g.coords.latitude))
      fields['gpsLngs'] = lib.waveletEncode(geoMeasurements.map(g => g.coords.longitude))
      fields['gpsAlts'] = lib.waveletEncode(geoMeasurements.map(g => g.coords.altitude))
      fields['gpsTimes'] = lib.waveletEncode(geoMeasurements.map(g => g.timestamp))
    }
    if (heartRateMeasurements.length) {
      const rrs = []
      heartRateMeasurements.forEach(hr => rrs.push(...hr.rrs))
      fields['rrCount'] = rrs.length
      fields['rrIntervals'] = lib.waveletEncode(rrs)
    }
    createSnapshot({
      workout: { id: goal.workout.id },
      exercise: { id: goal.id, name: goal.name, ...fields },
    })
  }

  const meters = METRICS.exercise.map(m => m.attr in goal ? <Meter key={m.attr} value={goal[m.attr]} {...m} /> : null)

  return (
    <div className='active-set'>
      <h3 className='exercise-name'>{goal.name}</h3>

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
      {navigator.geolocation && (goal.distance_m ?? 0) ?
       <PathTracker
         recent={geoMeasurements.length && geoMeasurements.slice(-1)[0]}
         distance={geoMeasurements.reduce(sumDistance, { acc: 0 }).acc}
         addMeasurement={m => setGeoMeasurements(c => [...c, m])}
         clear={() => setGeoMeasurements([])}
         samplePeriodSec={60} /> : null}

      {fields.duration_s ? (
        <div className='finalize'>
          {METRICS.exercise.map(m => m.attr in fields ? <Meter key={m.attr}
                                                               value={fields[m.attr]}
                                                               onChange={update(m.attr)}
                                                               {...m} /> : null)}
          <div className='available'>{METRICS.exercise.map(
            m => m.attr in fields ? null : <span key={m.attr}
                                                 title={m.label}
                                                 onClick={() => setFields(kv => ({ [m.attr]: 0, ...kv }))}
                                           >{m.emoji}</span>
          )}</div>
          <button className='save' onClick={commit}>Save</button>
        </div>
      ) : (
        <div className='info'>
          {meters}
          {!utc ? <button className='start' onClick={start}>Start!</button>
           : goal.duration_s ? <Timer seconds={goal.duration_s} finish={finish} />
           : <Stopwatch utc={utc} finish={finish} />
          }
        </div>
      )}
    </div>
  )
}


const sumDistance = ({ acc, prev }, geo) => {
  const { latitude: lat, longitude: lng } = geo.coords
  const [e, n] = geoToUtmConverter(getUtmZone(geo))([lng, lat])
  if (!prev) return { acc: 0, prev: [e, n] }
  const [pe, pn] = prev
  const [de, dn] = [e - pe, n - pn]
  return { acc: acc + Math.sqrt(de * de + dn * dn), prev: [e, n] }
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
    if (finished || remaining > 0) return
    alarm.current.play()
    finish()
    setFinished(true)
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
    <>
      <div className='stopwatch'>
        <span className='emoji'>⏱️</span>
        <span className='value'>{lib.formatDuration(elapsed)}</span>
      </div>
      <button className='finish' onClick={finish}>Finish</button>
    </>
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

  const sample = e => addMeasurement(parseHeartRate(e.target.value))

  useEffect(() => {
    console.log('heart rate monitor is', enabled ? 'enabled' : 'disabled')

    if (!enabled) return

    const heartRateMonitor = (async () => {
      const bt = navigator.bluetooth
      const device = await bt.requestDevice({ filters: [{ services: ['heart_rate'] }] })
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService('heart_rate')
      return await service.getCharacteristic('heart_rate_measurement')
    })()

    heartRateMonitor.addEventListener('characteristicvaluechanged', sample)
    heartRateMonitor.startNotifications()

    return () => {
      heartRateMonitor.stopNotifications()
      heartRateMonitor.removeEventListener('characteristicvaluechanged', sample)
    }
  }, [enabled])

  return (
    <div className={`heart-rate-monitor ${enabled ? 'enabled' : 'disabled'}`}
         onDoubleClick={clear}
         onClick={() => setEnabled(on => !on)}>
      <span className='emoji'>💗</span>
      <span className='value'>{heartRate || '---'}</span>
    </div>
  )
}


const PathTracker = ({ distance, addMeasurement, clear, samplePeriodSec }) => {
  const [enabled, setEnabled] = useState(true)

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
      <span className='distance'>{`${distance} m`}</span>
    </div>
  )
}
