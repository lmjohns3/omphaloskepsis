import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { loadFrom } from './common.jsx'
import { Map, withGeo } from './geo.jsx'

import './sleep.styl'

const Sleep = () => {
  const id = useParams().id
  const [geo, setGeo] = useState({})
  const [span, setSpan] = useState({})
  const [events, setEvents] = useState([])

  useEffect(() => {
    loadFrom(`/api/v1/spans/${id}/`, {}, setSpan)
    loadFrom(`/api/v1/spans/${id}/events/`, {}, setEvents)
    withGeo(setGeo)
  }, [])

  return <div className='sleep'>
    <Map lat={geo.lat || 0}
         lng={geo.lng || 0}
         onChanged={([lat, lng]) => setGeo({ lat, lng })} />
    {events.map(event => <Event key={event.id} event={event} />)}
  </div>
}

const Event = ({ event }) => {
  return <div className='event'>
    {event.note}
  </div>
}

export { Sleep }
