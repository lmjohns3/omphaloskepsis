import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import React, { useEffect, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import SunCalc from 'suncalc'

import { apiCreate, apiRead, apiUpdate, apiDelete } from './api.jsx'
import { useActivated, useRefresh } from './common.jsx'
import { useGeo } from './geo.jsx'

import './timeline.styl'

const KEY_FMT = 'YYYYMMDD'
const keyForDay = utc => utc.format(KEY_FMT)
const dayFromKey = key => dayjs.utc(key, KEY_FMT)


// Maintain a moving window over a contiguous group of days. Total number of days
// in the window is `2 * size + 1`.
const dayWindow = size => {
  const history = useHistory()
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
    history.replace(`#${centerKey}`)
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

  const update = snapshot => setCache(cache_ => {
    if (snapshot?.id) return { ...cache_, [snapshot.id]: snapshot }
    const { [snapshot]: _, ...remaining } = cache_
    return remaining
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
    const dgroups = {}, cgroups = {}
    Object.values(cache).forEach(snapshot => {
      const dayKey = keyForDay(dayjs.unix(snapshot.utc).tz('UTC'))
      if (!(dayKey in dgroups)) dgroups[dayKey] = []
      dgroups[dayKey].push(snapshot.id)
      const cid = snapshot.collection_id
      if (cid) {
        if (!(cid in cgroups)) cgroups[cid] = []
        cgroups[cid].push(snapshot.id)
      }
    })
    setGroups({ days: dgroups, collections: cgroups })
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
                               cache={cache}
                               updateCache={updateCache} />)}
    </div>
  )
}


// Simplify: 100[%] * dt[msec] / (86400[sec/day] * 1000[msec/sec]) ==>
// dt / 864000 [% day].
const pct = (begin, end) => `${end.diff(begin) / 864000}%`


// Given a time in UTC, and some snapshots (from which we extract lat/lng), compute
// sunrise and sunset times for days around then.
const geoMoments = (utc, snapshots) => {
  const geos = snapshots.filter(e => (e.lat && e.lng))
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
const Day = ({ yyyymmdd, refresh, cache, groups, updateCache }) => {
  const left = dayFromKey(yyyymmdd)
  const snapshots = (yyyymmdd in groups.days) ? groups.days[yyyymmdd].map(sid => cache[sid]) : []
  const sun = geoMoments(left, snapshots)
  const [ref, isActivated, setIsActivated] = useActivated()

  const singletonCollections = Object.values(groups.collections).filter(sids => sids.length === 1).length

  const createSnapshot = () => {
    console.log(snapshots)
    console.log(groups)
    console.log(singletonCollections)
  }

  const seenCollections = {}
  const children = []

  snapshots.forEach(snapshot => {
    const cid = snapshot.collection_id
    if (cid && !seenCollections[cid]) {
      seenCollections[cid] = true
      children.push(<Collection key={`collection-${cid}`}
                                left={left}
                                collection={{ id: cid, snapshots: groups.collections[cid] }}
                                snapshots={snapshots}
                                updateCache={updateCache}
                                refresh={refresh} />)
    } else {
      children.push(<Snapshot key={`snapshot-${snapshot.id}`}
                              left={left}
                              snapshot={snapshot}
                              updateCache={updateCache}
                              refresh={refresh} />)
    }
  })

  const pcts = (begin, end) => ({ left: pct(left, begin), width: pct(begin, end) })

  return (
    <div className={['day',
                     isActivated ? 'activated' : '',
                     left.format('ddd'),
                     left.format('MMM'),
                     `the-${left.format('D')}`].join(' ')} ref={ref}
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
      {keyForDay(dayjs.utc()) === yyyymmdd ? <Now updateCache={updateCache} /> : null}
    </div>
  )
}


// A widget that shows the current time on the timeline.
const Now = ({ updateCache }) => {
  const history = useHistory()
  const [ref, isActivated, setIsActivated] = useActivated()
  const [now, setNow] = useState(dayjs.utc())

  const create = (dtype, args) => {
    console.log(dtype, args)
    apiCreate(`${dtype}s`, args).then(res => history.push(`/${dtype}/${res.id}/`))
  }

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
          <span onClick={() => create('snapshot')}>🗒️️</span>
          <span onClick={() => create('collection', { tags: ['sleep'] })}>💤</span>
          <span onClick={() => history.push('/workout/new/')}>🏋️</span>
        </>
      ): '+'}
    </button>
  )
}


// A Collection is a group of related Snapshots -- for example, a period of sleep
// marked by a beginning (going to sleep) and end (waking up) snapshot. Visually,
// collections are just shown as a stripe between the first and last Snapshots.
const Collection = ({ left, collectionId, snapshots, addSnapshot, removeSnapshot, refresh }) => {
  const history = useHistory()
  const first = dayjs.unix(snapshots[0].utc).tz('UTC')
  const last = dayjs.unix(snapshots.slice(-1)[0].utc).tz('UTC')
  const right = left.add(24, 'h').subtract(1, 's')
  const wakeup = dayjs.min(dayjs.utc(), left.add(20, 'h'))

  // For sleep collections with one snapshot, show a button that adds another snapshot.
  return <>
    <div key={`collection-${collectionId}`}
         className={`collection`}
         title={dayjs.duration(last.diff(first))
                     .toISOString()  // Produces something like 'PT3H2M38S'
                     .replace(/PT/, '')
                     .replace(/\d+S$/, '')  // Trim off seconds.
                     .toLowerCase()}
         onClick={() => history.push(`/collection/${collectionId}/`)}
         style={{ left: pct(left, first), width: pct(first, wakeup) }}></div>
    <div key={`collection-${collectionId}-wakeup`}
         className='snapshot'
         style={{ left: pct(left, wakeup) }}
         onClick={() => apiCreate('snapshots', {
           utc: wakeup.unix(),
           collectionid: collectionId,
         }).then(res => history.push(`/snapshot/${res.id}/`))}>
      <div className='marker wakeup'>⏰</div>
    </div>
  </>
}


// A Snapshot is a marked point in time when we wanted to record something.
// Visually, Snapshots show up as a marker that, when tapped, toggles a
// context menu of edit/delete tools. The "move" tool lets us drag Snapshots
// to new times in the Timeline.
const Snapshot = ({ left, snapshot, updateCache, refresh }) => {
  const history = useHistory()
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
      apiDelete(`snapshot/${snapshot.id}`).then(() => updateCache(snapshot.id))
      setNeedsConfirmation(false)
    } else {
      setNeedsConfirmation(true)
    }
  }

  const doEdit = () => history.push(
    snapshot.workout_id ? `/workout/${snapshot.workout_id}/`
      : snapshot.collection_id ? `/collection/${snapshot.collection_id}/`
      : `/snapshot/${snapshot.id}/`)

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
      apiUpdate(`snapshot/${snapshot.id}`, { utc: snapshot.utc }).then(refresh)
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
    <div ref={ref} className={`snapshot ${isActivated ? 'activated' : ''}`}
         style={{ left: pct(left, dayjs.unix(snapshot.utc).add(dragDelta.x, 'm')),
                  top: `calc(0.1rem + ${dayHeight * dragDelta.y}px)` }}>
      <span className='button delete'
            onClick={doDelete}>🗑️ {needsConfirmation ? '?' : null}</span>
      <span className={`marker ${pol} pol-${Math.floor(abs / 26)}`}
            onMouseDown={() => isActivated ? doEdit() : setIsActivated(true)}>{
              dragStart ? '--:--' : isActivated ? '🔍' : HHmm}</span>
      <span className='button move'
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}>☷</span>
    </div>
  )
}

// 📍️

export { Timeline }
