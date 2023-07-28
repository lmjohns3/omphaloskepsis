import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import React, { useEffect, useRef, useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router-dom'
import SunCalc from 'suncalc'

import { apiCreate, apiUpdate } from './api.jsx'
import { useLongPress } from './common.jsx'
import lib from './lib.jsx'

import './timeline.styl'

const KEY_FMT = 'YYYYMMDD'
const keyForDay = utc => utc.format(KEY_FMT)
const dayFromKey = key => dayjs.utc(key, KEY_FMT)


const Timeline = () => {
  const { snapshots, collections } = useLoaderData()

  const days = {}
  for (let i = 0; i < 90; ++i) {
    days[keyForDay(dayjs.utc().subtract(i, 'd'))] = []
  }

  Object.values(snapshots).forEach(snap => {
    const key = keyForDay(dayjs.unix(snap.utc).tz('UTC'))
    if (!(key in days)) days[key] = []
    days[key].push(snap.id)
  })

  return (
    <div className='timeline'>
      <div className='tick' style={{ left: '12.5%' }}></div>
      <div className='tick' style={{ left: '25%' }}></div>
      <div className='tick' style={{ left: '37.5%' }}></div>
      <div className='tick' style={{ left: '50%' }}></div>
      <div className='tick' style={{ left: '62.5%' }}></div>
      <div className='tick' style={{ left: '75%' }}></div>
      <div className='tick' style={{ left: '87.5%' }}></div>
      {Object.keys(days).sort().reverse().map(
        key => <Day key={key}
                    yyyymmdd={key}
                    days={days}
                    snapshots={snapshots}
                    collections={collections} />)}
    </div>
  )
}


const pct = (begin, end) => `${100 * end.diff(begin) / end.diff(end.subtract(24, 'h'))}%`


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
// single 24-hour period (currently assumed to be midnight-to-midnight in UTC).
const Day = ({ yyyymmdd, days, snapshots, collections }) => {
  const left = dayFromKey(yyyymmdd)
  const snaps = (yyyymmdd in days) ? days[yyyymmdd].map(sid => snapshots[sid]) : []
  const sun = geoMoments(left, snaps)

  const seen = {}
  const children = []
  snaps.forEach(snap => {
    const cid = snap.collection_id
    if (cid) {
      if (seen[cid]) return
      children.push(<Collection key={`collection-${cid}`}
                                left={left}
                                snapshots={snapshots}
                                collection={collections[cid]} />)
      seen[cid] = true
    } else {
      children.push(<Snapshot key={`snapshot-${snap.id}`} left={left} snapshot={snap} />)
    }
  })

  const pcts = (begin, end) => ({ left: pct(left, begin), width: pct(begin, end) })

  return (
    <div className={['day',
                     left.format('ddd'),
                     left.format('MMM'),
                     `the-${left.format('D')}`].join(' ')}>
      {sun.t.sunset ? <>
        <div className='shadow' style={pcts(sun.tm1.sunset, sun.t.sunrise)}></div>
        <div className='shadow' style={pcts(sun.tm1.dusk, sun.t.dawn)}></div>
        <div className='shadow' style={pcts(sun.tm1.nauticalDusk, sun.t.nauticalDawn)}></div>
        <div className='shadow' style={pcts(sun.t.sunset, sun.tp1.sunrise)}></div>
        <div className='shadow' style={pcts(sun.t.dusk, sun.tp1.dawn)}></div>
        <div className='shadow' style={pcts(sun.t.nauticalDusk, sun.tp1.nauticalDawn)}></div>
       </> : null}
      <span className='label'>{left.format(left.date() === 1 ? 'D dd MMM YYYY' : 'D dd')}</span>
      {children}
    </div>
  )
}


// A Collection is a group of related Snapshots -- for example, a period of sleep
// marked by a beginning (going to sleep) and end (waking up) snapshot. Visually,
// collections are just shown as a stripe between the first and last Snapshots.
const Collection = ({ left, collection, snapshots }) => {
  const navigate = useNavigate()

  const isHabit = collection.flavor === 'habit'
  const isSleep = collection.flavor === 'sleep'
  const isWorkout = collection.flavor === 'workout'

  const allSnaps = collection.snapshot_ids.map(sid => snapshots[sid])
  const visibleSnaps = allSnaps.filter(snap => {
    const diff = snap.utc - left.unix()
    return 0 < diff && diff < 86400
  })//.sort((a, b) => b.utc - a.utc)

  const right = dayjs.min(dayjs.utc(), left.add(86399, 's'))
  const first = visibleSnaps.length && allSnaps.length && visibleSnaps[0].id === allSnaps[0].id
        ? dayjs.unix(allSnaps[0].utc).tz('UTC') : left
  const last = lib.last(visibleSnaps).id === lib.last(allSnaps).id
        ? dayjs.unix(lib.last(allSnaps).utc).tz('UTC') : right

  return (
    <>
      {(allSnaps.length > 1 && !isWorkout) ? (
        <div className='duration'
             title={`${collection.flavor} ${lib.formatDuration(lib.last(allSnaps).utc - allSnaps[0].utc)}`}
             style={{ left: pct(left, first), width: pct(first, last) }}></div>
      ) : null}
      <Snapshot left={left}
                url={isWorkout ? `/workout/${collection.id}/` : isHabit ? `/collection/${collection.id}/` : null}
                icon={isWorkout ? '🏋️' : isSleep ? '💤' : isHabit ? collection.kv.icon : null}
                snapshot={visibleSnaps[0]} />
      {isSleep && allSnaps.length === 1 && (
        <div className='snapshot wakeup'
             style={{ left: pct(left, right) }}
             onClick={() => apiCreate('snapshots', {
               utc: right.unix(),
               collection_id: collection.id,
             }).then(res => navigate(`/snapshot/${res.id}/`))}>
          <div className='marker'>⏰</div>
        </div>
      )}
      {isSleep && visibleSnaps.length > 1 && (
        <Snapshot left={left} icon='⏰' snapshot={visibleSnaps[1]} />)}
    </>
  )
}


// A Snapshot is a marked point in time when we wanted to record something.
// Visually, Snapshots show up as a marker that, when tapped, toggles a
// context menu of edit/delete tools. The "move" tool lets us drag Snapshots
// to new times in the Timeline.
const Snapshot = ({ left, snapshot, icon, url }) => {
  const navigate = useNavigate()
  const ref = useRef()

  const mood = snapshot.kv.mood || 0
  const pol = mood > 0 ? 'pos' : mood < 0 ? 'neg' : ''
  const canLongPress = !(url ?? '').startsWith('/workout')

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
      y: Math.floor((y - dragStart.y) / dayHeight)
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

  const onDrop = e => {
    e.preventDefault()
    snapshot.utc = dayjs.unix(snapshot.utc)
      .add(dragDelta.x, 'm')
      .subtract(dragDelta.y, 'd')
      .unix()
    apiUpdate(`snapshot/${snapshot.id}`, { utc: snapshot.utc }).then(() => navigate('/timeline/'))
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

  const onClick = e => navigate(url || `/snapshot/${snapshot.id}/`)

  const clickHandlers = canLongPress ? useLongPress(e => setDragStart(snapshotXY(e)), onClick) : { onClick }

  return (
    <div ref={ref}
         id={`snapshot-${snapshot.id}`}
         className={`snapshot ${dragStart ? 'dragging' : ''}`}
         style={{
           left: pct(left, dayjs.unix(snapshot.utc).add(dragDelta.x, 'm')),
           top: `calc(0.25rem + ${dayHeight * dragDelta.y}px)`,
         }}
         {...clickHandlers}>
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

export { Timeline }
