import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SunCalc from 'suncalc'

import { apiCreate, apiRead, apiUpdate, apiDelete } from './api.jsx'
import { useActivated, useRefresh } from './common.jsx'
import lib from './lib.jsx'

import './timeline.styl'

const KEY_FMT = 'YYYYMMDD'
const keyForDay = utc => utc.format(KEY_FMT)
const dayFromKey = key => dayjs.utc(key, KEY_FMT)


// Maintain a moving window over a contiguous group of days. Total number of days
// in the window is `2 * size + 1`.
const dayWindow = size => {
  const navigate = useNavigate()
  const centerKey = (useLocation().hash || `#${keyForDay(dayjs.utc())}`).slice(1)
  const [dayKeys, setDayKeys] = useState([])

  const recenter = centerKey => {
    const newKeys = []
    const limit = dayjs.utc().endOf('d')
    const ctr = dayFromKey(centerKey)
    for (let i = size; i >= -size; i--) {
      const day = ctr.add(i, 'd')
      if (!day.isAfter(limit)) newKeys.push(keyForDay(day))
    }
    navigate(`#${centerKey}`, { replace: true })
    setDayKeys(newKeys)
  }

  useEffect(() => { recenter(centerKey) }, [])

  // Listen to scroll events to know when to update the center of the window.
  useEffect(() => {
    let debounce = null
    const handler = () => {
      if (debounce) return
      debounce = setTimeout(() => { debounce = null }, 200)
      // Document body contains all currently rendered days. Compute the
      // distance between the middle of the viewport (innerHeight / 2) and the
      // top of the document's bounding box, and compare this to the height of
      // the document's bounding box to get the fraction of days that are
      // displayed above the middle of the viewport.
      const { top, height } = document.body.getBoundingClientRect()
      const frac = (window.innerHeight / 2 - top) / height
      const len = Math.floor(frac * dayKeys.length)
      const idx = frac < 0 ? 0 : frac >= 1 ? dayKeys.length - 1 : len
      if (dayKeys[idx] && (frac < 0.4 || frac > 0.6)) recenter(dayKeys[idx])
    }
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [dayKeys])

  return dayKeys
}


// Cache snapshots that have been loaded from the server.
const cacheSnapshots = dayKeys => {
  const [cache, setCache] = useState({})
  const loadedDays = useRef({})

  const update = snapshot => setCache(cur => {
    if (snapshot?.id) {
      cur[snapshot.id] = snapshot
    } else {
      delete cur[snapshot]
    }
    return { ...cur }
  })

  useEffect(() => {
    for (const dayKey of dayKeys) {
      if (dayKey in loadedDays.current) continue
      loadedDays.current[dayKey] = true
      const t = dayFromKey(dayKey)
      apiRead('snapshots', {
        start: t.startOf('d').unix(),
        end: t.endOf('d').unix()
      }).then(res => res.forEach(update))
    }
  }, [dayKeys])

  return [cache, update]
}


const Timeline = () => {
  const refresh = useRefresh()
  const dayKeys = dayWindow(30)

  const [cache, updateCache] = cacheSnapshots(dayKeys)
  const [groups, setGroups] = useState({ days: {}, collections: {} })

  useEffect(() => {
    const days = {}, collections = {}
    Object.values(cache).forEach(snapshot => {
      const key = keyForDay(dayjs.unix(snapshot.utc).tz('UTC'))
      if (!(key in days)) days[key] = []
      days[key].push(snapshot.id)
      const cid = snapshot.collection_id
      if (!cid) return
      if (!(cid in collections)) collections[cid] = []
      collections[cid].push(snapshot.id)
    })
    setGroups({ days, collections })
  }, [cache])

  return (
    <div className='timeline'>
      <div className='tick' style={{ left: '12.5%' }}></div>
      <div className='tick' style={{ left: '25%' }}></div>
      <div className='tick' style={{ left: '37.5%' }}></div>
      <div className='tick' style={{ left: '50%' }}></div>
      <div className='tick' style={{ left: '62.5%' }}></div>
      <div className='tick' style={{ left: '75%' }}></div>
      <div className='tick' style={{ left: '87.5%' }}></div>
      {dayKeys.map(key => <Day key={key}
                               yyyymmdd={key}
                               refresh={refresh}
                               groups={groups}
                               snapshots={cache}
                               update={updateCache} />)}
    </div>
  )
}


// Simplify: 100[%] * dt[msec] / (86400[sec/day] * 1000[msec/sec]) ==>
// dt / 864000 [% day].
const pct = (begin, end) => `${end.diff(begin) / 864000}%`


// Given a time in UTC, and some snapshots (from which we extract lat/lng), compute
// sunrise and sunset times for days around then.
const geoMoments = (utc, snapshots) => {
  const geos = snapshots.filter(e => e && e.lat && e.lng)
  const { lat, lng } = geos.length > 0 ? geos[0] : {}

  if (!lat || !lng) return { tm1: {}, t: {}, tp1: {} }

  const moments = utc => {
    const kvs = SunCalc.getTimes(utc.toDate(), lat, lng)
    return Object.fromEntries(
      Object.entries(kvs).map(([k, v]) => [k, dayjs(v)]))
  }

  return {
    tm1: moments(utc.add(-1, 'd')),
    t: moments(utc),
    tp1: moments(utc.add(1, 'd'))
  }
}


// Snapshots in the timeline are grouped and presented by day. A Day here is a
// component that shows a single 24-hour period (currently assumed to be
// midnight-to-midnight in UTC).
const Day = ({ yyyymmdd, refresh, snapshots, groups, update }) => {
  const left = dayFromKey(yyyymmdd)
  const snaps = (yyyymmdd in groups.days) ? groups.days[yyyymmdd].map(sid => snapshots[sid]) : []
  const sun = geoMoments(left, snaps)
  const [ref, isActivated, setIsActivated] = useActivated()

  const seen = {}
  const children = []
  snaps.forEach(snap => {
    if (!snap) return
    const cid = snap.collection_id
    if (cid && !seen[cid] && groups.collections[cid]) {
      seen[cid] = true
      children.push(<Collection key={`collection-${cid}`}
                                left={left}
                                collectionId={cid}
                                update={update}
                                refresh={refresh} />)
    } else {
      children.push(<Snapshot key={`snapshot-${snap.id}`}
                              left={left}
                              snapshot={snap}
                              update={update}
                              refresh={refresh} />)
    }
  })

  const pcts = (begin, end) => ({ left: pct(left, begin), width: pct(begin, end) })

  return (
    <div className={['day',
                     isActivated ? 'activated' : '',
                     left.format('ddd'),
                     left.format('MMM'),
                     `the-${left.format('D')}`].join(' ')}
         ref={ref}
         onMouseDown={() => setIsActivated(true)}
         onTouchStart={() => setIsActivated(true)}>
      {!sun.t.sunset ? null : <>
        <div className='shadow' style={pcts(sun.tm1.sunset, sun.t.sunrise)}></div>
        <div className='shadow' style={pcts(sun.tm1.dusk, sun.t.dawn)}></div>
        <div className='shadow' style={pcts(sun.tm1.nauticalDusk, sun.t.nauticalDawn)}></div>
        <div className='shadow' style={pcts(sun.t.sunset, sun.tp1.sunrise)}></div>
        <div className='shadow' style={pcts(sun.t.dusk, sun.tp1.dawn)}></div>
        <div className='shadow' style={pcts(sun.t.nauticalDusk, sun.tp1.nauticalDawn)}></div>
      </>}
      <span className='label'>{left.format(left.date() === 1 ? 'dd D MMM YYYY' : 'dd D')}</span>
      {children}
      {keyForDay(dayjs.utc()) === yyyymmdd ? <Now /> : null}
    </div>
  )
}


// A widget that shows the current time on the timeline.
const Now = () => {
  const navigate = useNavigate()
  const [ref, isActivated, setIsActivated] = useActivated()
  const [now, setNow] = useState(dayjs.utc())

  useEffect(() => {
    const id = setInterval(() => setNow(dayjs.utc()), 60000)
    return clearInterval(id)
  }, [])

  return (
    <button ref={ref}
            className={`add ${isActivated ? 'active' : ''}`}
            onClick={() => setIsActivated(true)}
            style={{left: pct(now.startOf('d'), now)}}>
      {isActivated ? (
        <>
          <span id='add-snapshot' onClick={() => apiCreate('snapshots').then(
                  res => navigate(`/snapshot/${res.id.toString(36)}/`))}>🗒️️</span>
          <span id='add-sleep' onClick={() => apiCreate('collections', { tags: ['sleep'] }).then(
                  res => navigate(`/snapshot/${res.snapshots[0].id.toString(36)}/`))}>💤</span>
          <span id='add-workout' onClick={() => navigate('/workout/new/')}>🏋️</span>
        </>
      ) : '+'}
    </button>
  )
}


// A Collection is a group of related Snapshots -- for example, a period of sleep
// marked by a beginning (going to sleep) and end (waking up) snapshot. Visually,
// collections are just shown as a stripe between the first and last Snapshots.
const Collection = ({ left, collectionId, update, refresh }) => {
  const navigate = useNavigate()

  const [collection, setCollection] = useState(null)

  useEffect(() => { apiRead(`collection/${collectionId}`).then(setCollection) }, [])

  if (!collection) return null

  const isWorkout = collection.tags.indexOf('workout') >= 0
  const isSleep = collection.tags.indexOf('sleep') >= 0

  const allSnaps = collection.snapshots
  const visibleSnaps = collection.snapshots.filter(snap => {
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
      {(allSnaps.length < 2 || isWorkout) ? null : (
        <div className='duration'
             title={`${collection.tags.join(' ')} ${lib.formatDuration(lib.last(allSnaps).utc - allSnaps[0].utc)}`}
             style={{ left: pct(left, first), width: pct(first, last) }}
             onClick={() => navigate(`/collection/${collectionId.toString(36)}/`)}></div>
      )}
      <Snapshot left={left}
                icon={isWorkout ? '🏋️' : null}
                snapshot={visibleSnaps[0]}
                update={update}
                refresh={refresh} />
      {allSnaps.length === 1 && isSleep ? (
        <div className='snapshot wakeup'
             style={{ left: pct(left, right) }}
             onClick={() => apiCreate('snapshots', {
               utc: right.unix(),
               collection_id: collectionId,
             }).then(res => navigate(`/snapshot/${res.id.toString(36)}/`))}>
          <div className='marker'>⏰</div>
        </div>
      ) : null}
    </>
  )
}


// A Snapshot is a marked point in time when we wanted to record something.
// Visually, Snapshots show up as a marker that, when tapped, toggles a
// context menu of edit/delete tools. The "move" tool lets us drag Snapshots
// to new times in the Timeline.
const Snapshot = ({ left, snapshot, update, refresh, icon }) => {
  const navigate = useNavigate()
  const [ref, isActivated, setIsActivated] = useActivated()
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 })
  const dayHeight = ref.current ? ref.current.parentNode.getBoundingClientRect().height : 0
  const HHmm = dayjs.unix(snapshot.utc).tz(snapshot.tz).format('H:mm')
  const snapshotXY = e => e.type.match(/^touch/)
    ? { x: e.touches[0].pageX, y: e.touches[0].pageY }
    : { x: e.clientX, y: e.clientY }

  const doDelete = () => {
    if (!isActivated) return
    if (needsConfirmation) {
      apiDelete(`snapshot/${snapshot.id}`).then(() => update(snapshot.id))
      setNeedsConfirmation(false)
    } else {
      setNeedsConfirmation(true)
    }
  }

  const doEdit = () => navigate(
    snapshot.collection_id
      ? `/collection/${snapshot.collection_id.toString(36)}/`
      : `/snapshot/${snapshot.id.toString(36)}/`
  )

  const onDragStart = e => {
    if (e.button !== 0) return
    e.preventDefault()
    setDragStart(snapshotXY(e))
  }

  useEffect(() => { setNeedsConfirmation(false) }, [isActivated])

  useEffect(() => {
    const handler = e => {
      e.preventDefault()
      const { x, y } = snapshotXY(e)
      setDragDelta({
        x: 1440 * (x - dragStart.x) / window.innerWidth,
        y: Math.floor((y - dragStart.y) / dayHeight)
      })
    }
    if (dragStart) {
      window.addEventListener('mousemove', handler)
      window.addEventListener('touchmove', handler)
      return () => {
        window.removeEventListener('mousemove', handler)
        window.removeEventListener('touchmove', handler)
      }
    }
  }, [dragStart])

  useEffect(() => {
    const handler = e => {
      e.preventDefault()
      snapshot.utc = dayjs.unix(snapshot.utc)
        .add(dragDelta.x, 'm')
        .subtract(dragDelta.y, 'd')
        .unix()
      apiUpdate(`snapshot/${snapshot.id}`, { utc: snapshot.utc }).then(update)
      setDragStart(null)
      setDragDelta({ x: 0, y: 0 })
      setIsActivated(false)
    }
    if (dragDelta.x || dragDelta.y) {
      window.addEventListener('mouseup', handler)
      window.addEventListener('touchstop', handler)
      return () => {
        window.removeEventListener('mouseup', handler)
        window.removeEventListener('touchstop', handler)
      }
    }
  }, [dragDelta.x, dragDelta.y])

  const mood = snapshot.mood || 0
  const pol = mood > 0 ? 'pos' : mood < 0 ? 'neg' : ''
  const abs = 100 * Math.abs(mood)

  return (
    <div ref={ref}
         id={`snap-${snapshot.id}`}
         className={`snapshot ${isActivated ? 'activated' : ''}`}
         style={{
           left: pct(left, dayjs.unix(snapshot.utc).add(dragDelta.x, 'm')),
           top: `calc(0.25rem + ${dayHeight * dragDelta.y}px)`,
         }}>
      <span className='button delete' onClick={doDelete}>🗑️ {needsConfirmation ? '?' : null}</span>
      <span className={`marker ${pol} pol-${Math.floor(abs / 26)}`}
            onMouseDown={
              () => snapshot.workout_id
                ? navigate(`/workout/${snapshot.workout_id.toString(36)}/`)
                : isActivated ? doEdit() : setIsActivated(true)
            }>{dragStart ? '☷' : isActivated ? '🔍' : icon || HHmm}</span>
      <span className='button move' onMouseDown={onDragStart} onTouchStart={onDragStart}>☷</span>
    </div>
  )
}

// 📍️

export { Timeline }
