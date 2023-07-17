import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import useNoSleep from 'use-no-sleep'
import React, { useEffect, useRef, useState } from 'react'
import { useLoaderData } from 'react-router-dom'

import { apiCreate, apiRead, apiUpdate } from './api.jsx'
import { useAuth } from './auth.jsx'
import { Meter } from './common.jsx'
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
  const { collection, snapshots: initialSnapshots } = useLoaderData()

  const [snapshots, setSnapshots] = useState(initialSnapshots)

  const goals = JSON.parse(collection.kv.goals)

  return (
    <div className='workout container'>
      {snapshots.length < goals.length ?
       <ActiveSet key={snapshots.length}
                  collection_id={collection.id}
                  goal={goals[snapshots.length]}
                  refresh={res => setSnapshots(s => [...s, res])} /> : null}
      {snapshots.reverse().map((s, i) =>
        <CompletedSet key={s.id} utc={s.utc} data={s.kv} goal={goals[i]} />
      )}
    </div>
  )
}


const CompletedSet = ({ utc, data, goal }) => (
  <div className='completed-set'>
    <h2 className='name'>{goal.name}</h2>
    <span className='finished'>{dayjs.unix(utc).add(data.duration_s, 's').fromNow()}</span>
    <div className='metrics'>
      <Meter value={lib.formatDuration(data.duration_s)} label='Duration' emoji='⏱️' />
      {data.reps ? <Meter value={data.reps} attr='reps' label='Reps' emoji='🧮' /> : null}
      {data.resistance_n ? <Meter value={data.resistance_n} attr='resistance_n' label='Resistance'
                                  emoji='🪨' formats={{ N: null, lb: 0.2248, kg: 0.102 }} /> : null}
      {data.distance_m ? <Meter value={data.distance_m} attr='distance_m' label='Distance'
                                emoji='📍' formats={{ m: null, km: 0.001, mi: 0.0062137 }} /> : null}
      {data.cadence_hz ? <Meter value={data.cadence_hz} attr='cadence_hz' label='Cadence'
                                emoji='🚲' formats={{ Hz: null, rpm: 60 }} /> : null}
      {data.avg_power_w ? <Meter value={data.avg_power_w} attr='avg_power_w' label='Average Power'
                                 emoji='⚡' formats={{ W: null, hp: 0.00134102 }} /> : null}
    </div>
  </div>
)


const ActiveSet = ({ goal, refresh }) => {
  const { collection } = useLoaderData()

  const [utc, setUtc] = useState(0)
  const [data, setData] = useState({})
  const [nosleep, setNosleep] = useState(false)
  const awake = useNoSleep(nosleep)

  const [stepTimes, setStepTimes] = useState([])
  const [geoMeasurements, setGeoMeasurements] = useState([])
  const [heartRateMeasurements, setHeartRateMeasurements] = useState([])

  const start = () => { setUtc(dayjs.utc().unix()); setNosleep(true) }

  const finish = () => {
    setNosleep(false)
    setData(d => ({ ...d, duration_s: dayjs.utc().unix() - utc}))
  }

  const update = attr => value => setData(d => ({ ...d, [attr]: value }))

  const commit = () => {
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
    apiCreate('snapshots', { utc: utc, collection_id: collection.id, ...data }).then(refresh)
  }

  return (
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
        {utc ? null : <button className='start' onClick={start}>⏱️ Start!</button>}
        {goal.name}
      </h1>

      {data.duration_s ? (
        <div className='finalize'>
          <Meter value={lib.formatDuration(data.duration_s)} label='Duration' emoji='⏲️' />
          <Meter value={data.reps || goal.reps} label='Reps' emoji='🧮' update={update('reps')} />
          <Meter value={data.resistance_n || goal.resistance_n} label='Resistance' update={update('resistance_n')}
                 emoji='🪨' formats={{ N: null, lb: 0.2248, kg: 0.102 }} />
          <Meter value={data.distance_m || goal.distance_m} label='Distance' update={update('distance_m')}
                 emoji='📍' formats={{ m: null, km: 0.001, mi: 0.0062137 }} />
          <Meter value={data.cadence_hz || goal.cadence_hz} label='Cadence' update={update('cadence_hz')}
                 emoji='🚲' formats={{ Hz: null, rpm: 60 }} />
          <Meter value={data.avg_power_w || goal.avg_power_w} label='Average Power' update={update('avg_power_w')}
                 emoji='⚡' formats={{ W: null, hp: 0.00134102 }} />
          <button className='save' onClick={commit}>Save</button>
        </div>
      ) : utc ? (
        goal.duration_s
          ? <Timer seconds={goal.duration_s} finish={finish} />
          : <Stopwatch utc={utc} finish={finish} />
      ) : (
        <div className='info'>
          <div className='goals'>
            {goal.reps ? <span className='reps'>Target reps: 🧮 {goal.reps}</span> : null}
            {goal.duration_s ? <span className='duration_s'>Target duration: ⏲️  {lib.formatDuration(goal.duration_s)}</span> : null}
            {goal.distance_m ? <span className='distance_m'>Target distance: 📍 {goal.distance_m}</span> : null}
            {goal.resistance_n ? <span className='resistance_n'>Target resistance: 🪨 {goal.resistance_n}</span> : null}
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
      <span className='distance'>{`${distance} m`}</span>
    </div>
  )
}


export { Workout }
