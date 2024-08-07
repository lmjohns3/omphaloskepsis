import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import Dexie from 'dexie'
import React, { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import SunCalc from 'suncalc'

import { useLongPress } from './common.jsx'
import { createSnapshot, db } from './db.jsx'
import lib from './lib.jsx'

import './timeline.styl'


export default () => {
  const top = useRef(null)
  const bottom = useRef(null)
  const [daysAgo, setDaysAgo] = useState([...Array(60).keys()])

  const handleIntersection = (ref, delta) => () => {
    const target = ref.current
    if (!target) return
    const observer = new IntersectionObserver(
      es => es[0].isIntersecting ? setDaysAgo(ds => ds.map(d => d + delta)) : null
    )
    observer.observe(target)
    return () => observer.unobserve(target)
  }

  useEffect(handleIntersection(top, -3), [top])
  useEffect(handleIntersection(bottom, 3), [bottom])

  return (
    <div className='timeline'>
      <div className='tick' style={{ left: '12.5%' }}></div>
      <div className='tick' style={{ left: '25%' }}></div>
      <div className='tick' style={{ left: '37.5%' }}></div>
      <div className='tick' style={{ left: '50%' }}></div>
      <div className='tick' style={{ left: '62.5%' }}></div>
      <div className='tick' style={{ left: '75%' }}></div>
      <div className='tick' style={{ left: '87.5%' }}></div>
      <div ref={top}></div>
      {daysAgo.map(d => <Day key={d} utcLeft={dayjs.utc().subtract(d, 'd').startOf('d')} />)}
      <div ref={bottom}></div>
    </div>
  )
}


const dayPercent = (a, b) => `${100 * b.diff(a) / b.diff(b.subtract(24, 'h'))}%`


// Given a time in UTC, and some snapshots (from which we extract lat/lng), compute
// sunrise and sunset times for days around then.
const geoMoments = (utc, snapshots) => {
  const geos = snapshots.filter(e => e && e.lat && e.lng)
  const { lat, lng } = geos.length > 0 ? geos[0] : {}

  const moments = utc => {
    const kvs = SunCalc.getTimes(utc.toDate(), lat, lng)
    return Object.fromEntries(
      Object.entries(kvs).map(([k, v]) => [k, dayjs(v)]))
  }

  return lat && lng ? {
    tm1: moments(utc.add(-1, 'd')),
    t: moments(utc),
    tp1: moments(utc.add(1, 'd'))
  } : { tm1: {}, t: {}, tp1: {} }
}


// Snapshots in the timeline are grouped by day. A Day here is a component that shows a
// single 24-hour period.
const Day = ({ utcLeft }) => {
  const navigate = useNavigate()

  const [x, y] = [utcLeft.unix(), utcLeft.add(24, 'h').add(1, 's').unix()]
  const snapshots = useLiveQuery(() => db.snapshots.where('utc').between(x, y).toArray())

  if (!snapshots) return null

  const sun = geoMoments(utcLeft, snapshots)
  const pcts = (a, b) => ({ left: dayPercent(utcLeft, a), width: dayPercent(a, b) })

  const renderedWorkouts = {}
  const renderedSleeps = {}

  return (
    <div className={['day', utcLeft.format('ddd'), utcLeft.format('MMM'), `the-${utcLeft.format('D')}`].join(' ')}>
      {sun.t.sunset ? <>
        <div className='shadow' style={pcts(sun.tm1.sunset, sun.t.sunrise)}></div>
        <div className='shadow' style={pcts(sun.tm1.dusk, sun.t.dawn)}></div>
        <div className='shadow' style={pcts(sun.tm1.nauticalDusk, sun.t.nauticalDawn)}></div>
        <div className='shadow' style={pcts(sun.t.sunset, sun.tp1.sunrise)}></div>
        <div className='shadow' style={pcts(sun.t.dusk, sun.tp1.dawn)}></div>
        <div className='shadow' style={pcts(sun.t.nauticalDusk, sun.tp1.nauticalDawn)}></div>
       </> : null}
      <span className='label'>
        <span>{utcLeft.format(utcLeft.date() === 1 ? 'MMMM' : 'D')}</span>
        <span>{utcLeft.format(utcLeft.date() === 1 ? 'YYYY' : 'ddd')}</span>
      </span>
      {snapshots.map(s => {
        if (s.workoutId) {
          if (renderedWorkouts[s.workoutId]) return null
          renderedWorkouts[s.workoutId] = true
          return <Workout key={s.id} utcLeft={utcLeft} id={s.workoutId} />
        }
        if (s.sleepId) {
          if (renderedSleeps[s.sleepId]) return null
          renderedSleeps[s.sleepId] = true
          return <Sleep key={s.id} utcLeft={utcLeft} id={s.sleepId} />
        }
        return <Snapshot key={s.id} utcLeft={utcLeft} snapshot={s} />
      })}
    </div>
  )
}


const Workout = ({ utcLeft, id }) => {
  const navigate = useNavigate()
  const snapshots = useLiveQuery(() => db.snapshots.where({ workoutId: id }).toArray())

  if (!snapshots) return null

  const first = dayjs.unix(snapshots[0]?.utc)

  return first ? (
    <div id={`workout-${id}`}
         className='snapshot'
         onClick={() => navigate(`/workout/${id}`)}
         style={{
           left: dayPercent(utcLeft, first),
           top: '0.25rem',
           ...(snapshots.length > 1 ? { width: dayPercent(first, dayjs.unix(lib.last(snapshots)?.utc)) } : {}),
         }}>
      <div className='marker' style={{ width: '100%' }}>🏋️</div>
    </div>
  ) : null
}


const Sleep = ({ utcLeft, id }) => {
  const navigate = useNavigate()
  const snapshots = useLiveQuery(() => db.snapshots.where({ sleepId: id }).toArray())

  if (!snapshots) return null

  const visible = snapshots.filter(s => {
    const diff = s.utc - utcLeft.unix()
    return 0 < diff && diff < 86400
  })

  const utcRight = dayjs.min(dayjs.utc(), utcLeft.add(1, 'd').subtract(1, 's'))
  const first = visible.length && snapshots.length && visible[0].id === snapshots[0].id
        ? dayjs.unix(snapshots[0].utc).tz('UTC') : utcLeft
  const last = lib.last(visible).id === lib.last(snapshots).id
        ? dayjs.unix(lib.last(snapshots).utc).tz('UTC') : utcRight

  return (
    <>
      {(snapshots.length > 1) ? (
        <div className='duration'
             title={`sleep ${lib.formatDuration(lib.last(snapshots).utc - snapshots[0].utc)}`}
             style={{ left: dayPercent(utcLeft, first), width: dayPercent(first, last) }}></div>
      ) : null}
      <Snapshot utcLeft={utcLeft} icon='💤' snapshot={visible[0]} />
      {snapshots.length === 1 && (
        <div className='snapshot wakeup'
             style={{ left: dayPercent(utcLeft, utcRight), top: '0.25rem' }}
             onClick={() => createSnapshot({ utc: utcRight.unix(), sleepId: id }).then(id => navigate(`/snapshot/${id}/`))}>
          <div className='marker'>⏰</div>
        </div>
      )}
      {visible.length > 1 && <Snapshot utcLeft={utcLeft} icon='⏰' snapshot={visible[1]} />}
    </>
  )
}


// A Snapshot is a marked point in time when we wanted to record something. Visually,
// Snapshots show up as a marker that, when tapped, toggles a context menu of edit/delete
// tools. The "move" tool lets us drag Snapshots to new times in the Timeline.
const Snapshot = ({ utcLeft, snapshot, icon }) => {
  const navigate = useNavigate()
  const ref = useRef()

  const mood = snapshot.mood || 0
  const pol = mood > 0 ? 'pos' : mood < 0 ? 'neg' : ''

  const [dragStart, setDragStart] = useState(null)
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 })

  const dayHeight = ref.current ? ref.current.parentNode.getBoundingClientRect().height : 0
  const snapshotXY = e => e.type.match(/^touch/)
    ? { x: e.touches[0].pageX, y: e.touches[0].pageY }
    : { x: e.clientX, y: e.clientY }

  const onDrag = e => {
    e.preventDefault()
    const { x, y } = snapshotXY(e)
    setDragDelta({
      x: 1440 * (x - dragStart.x) / window.innerWidth,
      y: Math.floor((y - dragStart.y) / dayHeight),
    })
  }

  useEffect(() => {
    if (dragStart) {
      window.addEventListener('mousemove', onDrag)
      window.addEventListener('touchmove', onDrag)
      return () => {
        window.removeEventListener('mousemove', onDrag)
        window.removeEventListener('touchmove', onDrag)
      }
    }
  }, [dragStart])

  const onDrop = async e => {
    e.preventDefault()
    await db.snapshots.update(snapshot.id, {
      utc: dayjs.unix(snapshot.utc)
        .add(dragDelta.x, 'm')
        .subtract(dragDelta.y, 'd')
        .unix()
    })
    setDragStart(null)
    setDragDelta({ x: 0, y: 0 })
  }

  useEffect(() => {
    if (dragDelta.x || dragDelta.y) {
      window.addEventListener('mouseup', onDrop)
      window.addEventListener('touchend', onDrop)
      return () => {
        window.removeEventListener('mouseup', onDrop)
        window.removeEventListener('touchend', onDrop)
      }
    }
  }, [dragDelta.x, dragDelta.y])

  return (
    <div ref={ref}
         id={`snapshot-${snapshot.id}`}
         className={`snapshot ${dragStart ? 'dragging' : ''}`}
         style={{
           left: dayPercent(utcLeft, dayjs.unix(snapshot.utc).add(dragDelta.x, 'm')),
           top: `calc(0.25rem + ${dayHeight * dragDelta.y}px)`,
         }}
         {...useLongPress(e => setDragStart(snapshotXY(e)), e => navigate(`/snapshot/${snapshot.id}/`))}>
      <div className={`marker ${pol}${Math.floor(100 * Math.abs(mood) / 26)}`}
           title={dayjs.unix(snapshot.utc).tz(snapshot.tz).format('H:mm')}>
        {dragStart ? '☷' :
         icon ? icon :
         snapshot.note ? '📝' :
         snapshot.lat ? '📍️' :
         '📌'}
      </div>
    </div>
  )
}
