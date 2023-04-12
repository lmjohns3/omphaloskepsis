import dayjs from 'dayjs'
import React, { useEffect, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import SunCalc from 'suncalc'

import { deleteFrom, loadFrom, postTo, useActivated, useRefresh } from './common.jsx'
import { Meter, Vitals } from './vitals.jsx'

import './timeline.styl'

const KEY_FMT = 'YYYYMMDD'

const keyForDay = utc => utc.format(KEY_FMT)
const dayFromKey = key => dayjs.utc(key, KEY_FMT)

// A moving window over a contiguous set of days. Total number of days in the
// window is `2 * size + 1`.
const dayWindow = size => {
  const history = useHistory()
  const center = (useLocation().hash || `#${keyForDay(dayjs.utc())}`).slice(1)
  const [days, setDays] = useState([])

  const update = key => {
    const window = []
    const limit = dayjs.utc().endOf('d')
    const ctr = dayFromKey(key)
    for (let i = size; i >= -size; i--) {
      const day = ctr.clone().add(i, 'd')
      if (!day.isAfter(limit)) window.push(keyForDay(day))
    }
    history.replace(`#${key}`)
    setDays(window)
  }

  useEffect(() => { update(center) }, [])

  // Listen to scroll events to know when to update the center of the window.
  let debounce = null
  useEffect(() => {
    const handler = () => {
      if (debounce) return
      debounce = setTimeout(() => { debounce = null }, 100)
      // Document body contains all currently rendered days. Compute the
      // distance between the middle of the viewport (innerHeight / 2) and the
      // top of the document's bounding box, and compare this to the height of
      // the document's bounding box to get the fraction of days that are
      // displayed above the middle of the viewport.
      const { top, height } = document.body.getBoundingClientRect()
      const frac = (window.innerHeight / 2 - top) / height
      const len = Math.floor(frac * days.length)
      const idx = frac < 0 ? 0 : frac >= 1 ? days.length - 1 : len
      if (days[idx] && (frac < 0.4 || frac > 0.6)) update(days[idx])
    }
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [days])

  return days
}

// Keep a set of events cached in memory after loading from the database.
const cachedEvents = days => {
  const spans = useRef({})
  const ids = useRef({})
  const loaded = useRef({})
  const [events, setEvents] = useState({})

  const addEvent = event => {
    if (!event || !event.id || ids.current[event.id]) return
    ids.current[event.id] = true
    const utc = dayjs.utc(event.utc)
    const key = keyForDay(utc)
    const sid = event.span ? event.span.id : null
    if (sid) {
      const sps = spans.current
      if (!sps[sid]) sps[sid] = event.span
      const idx = sps[sid].events.map(ev => ev.id).indexOf(event.id)
      if (idx < 0) sps[sid].events.push(event)
      else sps[sid].events[idx] = event
      event.span = sps[sid]
    }
    setEvents(events_ => {
      const evs = events_[key] || []
      if (evs.map(ev => ev.id).includes(event.id)) return events_
      evs.push(event)
      return { ...events_, [key]: evs }
    })
  }

  useEffect(() => {
    let start = null
    let end = null

    const loadBatch = () => {
      if (start === null || end === null) return
      console.log('loading', start, end)
      loadFrom('events', {
        start: dayFromKey(start).startOf('d').format(),
        end: dayFromKey(end).endOf('d').format()
      }, evs => evs.forEach(addEvent))
      start = end = null
    }

    days.forEach(key => {
      if (loaded.current[key]) {
        loadBatch()
      } else {
        loaded.current[key] = true
        if (end === null) {
          end = key
          start = keyForDay(dayFromKey(key).add(-1, 'd'))
        } else if (start === key) {
          start = keyForDay(dayFromKey(start).add(-1, 'd'))
        } else {
          loadBatch()
        }
      }
    })

    loadBatch()
  }, [days, events])

  return [events, addEvent]
}

const Timeline = () => {
  const days = dayWindow(30)
  const [events, addEvent] = cachedEvents(days)

  return <div className='timeline'>
    <div className='tick' style={{ left: '12.5%' }}></div>
    <div className='tick' style={{ left: '25%' }}></div>
    <div className='tick' style={{ left: '37.5%' }}></div>
    <div className='tick' style={{ left: '50%' }}></div>
    <div className='tick' style={{ right: '37.5%' }}></div>
    <div className='tick' style={{ right: '25%' }}></div>
    <div className='tick' style={{ right: '12.5%' }}></div>
    {days.map(key => <Day key={key}
                          yyyymmdd={key}
                          events={events[key] || []}
                          addEvent={addEvent} />)}
  </div>
}

// Simplify: 100[%] * dt[msec] / (86400[sec/day] * 1000[msec/sec]) ==>
// dt / 864000 [% day].
const pct = (begin, end) => `${end.diff(begin) / 864000}%`

// Given a time in UTC, and some events (from which we extract lat/lng), compute
// sunrise and sunset times for days around then.
const geoMoments = (utc, events) => {
  const geos = events.filter(e => (e.lat && e.lng))
  const { lat, lng } = geos.length > 0 ? geos[0] : {}

  if (!lat || !lng) return { tm1: {}, t: {}, tp1: {} }

  const moments = utc => {
    const kvs = SunCalc.getTimes(utc.toDate(), lat, lng)
    return Object.fromEntries(
      Object.entries(kvs).map(([k, v]) => [k, dayjs.utc(v)]))
  }

  return {
    tm1: moments(utc.subtract(1, 'd')),
    t: moments(utc.add(1, 'd')),
    tp1: moments(utc.add(1, 'd'))
  }
}

// Events in the timeline are grouped and presented by day. A Day here is a
// component that shows a single 24-hour period (currently assumed to be
// midnight-to-midnight in UTC).
//
// A Day contains both Events and Spans (groups of Events). Changes in any
// content owned by the Day trigger a refresh on the Day, which allows for some
// quick-and-dirty UI synchronization.
const Day = ({ yyyymmdd, events, addEvent }) => {
  const left = dayFromKey(yyyymmdd)
  const sc = geoMoments(left.clone(), events)
  const refresh = useRefresh()
  const [ref, isActivated, setIsActivated] = useActivated()
  const spans = {}
  const children = []

  // Create Event and Span components for anything that happened in this Day.
  events.forEach(ev => {
    const hasSpan = ev.span
    const needsSpan = hasSpan && !spans[ev.span.id]
    const isSleepEvent = hasSpan && ev.span.activity === 'sleep'
    const isFirstSpanEvent = hasSpan && ev.span.events[0].id === ev.id
    if (needsSpan) {
      spans[ev.span.id] = true
      children.push(<Span key={`span-${ev.span.id}`} left={left} span={ev.span}
                          addEvent={addEvent} refresh={refresh} />)
    }
    if (ev.utc && (!hasSpan || isSleepEvent)) {
      children.push(<Event key={`event-${ev.id}`} left={left} event={ev}
                           refresh={refresh} />)
    }
  })

  const pcts = (begin, end) => ({ left: pct(left, begin), width: pct(begin, end) })

  return <div className={['day', isActivated ? 'activated' : '', left.format('ddd'),
                          `the-${left.format('Do')}`].join(' ')} ref={ref}
              onMouseDown={() => setIsActivated(true)}
              onTouchStart={() => setIsActivated(true)}>
    {!sc.t.sunset ? null : <>
      <div className='shadow' style={pcts(sc.tm1.sunset, sc.t.sunrise)}></div>
      <div className='shadow' style={pcts(sc.tm1.dusk, sc.t.dawn)}></div>
      <div className='shadow' style={pcts(sc.tm1.nauticalDusk, sc.t.nauticalDawn)}></div>
      <div className='shadow' style={pcts(sc.t.sunset, sc.tp1.sunrise)}></div>
      <div className='shadow' style={pcts(sc.t.dusk, sc.tp1.dawn)}></div>
      <div className='shadow' style={pcts(sc.t.nauticalDusk, sc.tp1.nauticalDawn)}></div>
    </>}
    <span className='label'>{left.format(left.date() === 1 ? 'D MMM YYYY' : 'D')}</span>
    {children}
  </div>
}

// A Span is a grouping of related Events -- for example, a Workout containing
// several exercise sets. Visually, spans are just shown as a stripe between
// the first and last Events.
const Span = ({ left, span, addEvent }) => {
  const history = useHistory()
  const first = dayjs.utc(span.events[0].utc)
  const last = dayjs.utc(span.events.slice(-1)[0].utc)
  const right = left.clone().add(24, 'h').subtract(1, 's')
  const wakeup = dayjs.min(dayjs.utc(), left.clone().add(20, 'h'))
  const asleep = span.activity === 'sleep' && span.events.length === 1

  // For sleep spans with one event, show a button that adds another event.
  return <>
    <div key={`span-${span.id}`}
         className={`span ${span.activity}`}
         title={dayjs.duration(last.diff(first))
                      .toISOString()
                      .replace(/PT/, '')
                      .replace(/\d+S$/, '')
                      .toLowerCase()}
         onClick={span.activity === 'workout' ?
           () => history.push(`/workout/${span.id}/`) : null}
         style={{
           left: pct(left, first),
           width: pct(first, asleep ? wakeup : dayjs.min(last, right))
         }}></div>
    {!asleep ? null : <div key={`span-${span.id}-wakeup`}
                           className='event'
                           style={{ left: pct(left, wakeup) }}
                           onClick={() => postTo('events', {
                             utc: wakeup.format(),
                             spanid: span.id
                           }, data => history.push(`/event/${data.id}/`))}>
      <div className='marker wakeup'>⏰</div>
    </div>}
  </>
}

// An Event is a marked point in time when we wanted to record something.
// Visually, Events show up as a marker that, when tapped, toggles a
// context menu of edit/delete tools. The "move" tool lets us drag Events
// to new times in the Day.
const Event = ({ left, event, refresh }) => {
  const history = useHistory()
  const [ref, isActivated, setIsActivated] = useActivated()
  const [dragStart, setDragStart] = useState(null)
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 })
  const dayHeight = ref.current
    ? ref.current.parentNode.getBoundingClientRect().height
    : 0
  const eventXY = e => e.type.match(/^touch/)
    ? { x: e.touches[0].pageX, y: e.touches[0].pageY }
    : { x: e.clientX, y: e.clientY }

  const onDragStart = e => {
    if (e.button !== 0) return
    e.preventDefault()
    setDragStart(eventXY(e))
  }

  useEffect(() => {
    const handler = e => {
      e.preventDefault()
      const { x, y } = eventXY(e)
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
      event.utc = dayjs.utc(event.utc)
        .add(dragDelta.x, 'm')
        .subtract(dragDelta.y, 'd')
        .format()
      postTo(`events/${event.id}`, { utc: event.utc }, refresh)
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

  const polarity = event.mood ? event.mood.polarity : 0
  const pol = polarity > 0 ? 'pos' : polarity < 0 ? 'neg' : ''
  const abs = 100 * Math.abs(polarity)

  return <div className={`event ${isActivated ? 'activated' : ''}`} ref={ref}
              style={{
                left: pct(left, dayjs.utc(event.utc).add(dragDelta.x, 'm')),
                top: `calc(0.1rem + ${dayHeight * dragDelta.y}px)`
              }}>
    {!isActivated ? null : <span className='button delete'
                                 onClick={() => deleteFrom(
                                   `events/${event.id}`, () => {
                                     event.id = event.utc = null
                                     refresh()
                                 })}>🗑️</span>}
    <span className={`marker ${pol} pol-${Math.floor(abs / 26)}`}
          onMouseDown={() => setIsActivated(true)}>{
      dayjs.utc(event.utc).add(event.offset + dragDelta.x, 'm').format('H:mm')
    }</span>
    {!isActivated ? null : <>
      <span className='button move' onMouseDown={onDragStart}
            onTouchStart={onDragStart}>↔️</span>
      <span className='button edit' onClick={() => history.push(
        event.span?.activity === 'workout'
          ? `/${event.span.activity}/${event.span.id}/`
          : `/event/${event.id}/`)}>🖊️️</span>
    </>}
  </div>
}

export { Timeline }
