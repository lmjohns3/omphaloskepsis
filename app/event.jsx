import React, { useEffect, useState } from 'react'
import { useHistory, useParams } from 'react-router-dom'
import showdown from 'showdown'

import { deleteFrom, loadFrom, postTo, When } from './common.jsx'
import { Map } from './geo.jsx'
import { Vitals } from './vitals.jsx'

import './event.styl'

const Event = () => {
  useEffect(() => {
    showdown.setOption('simplifiedAutoLink', true)
    showdown.setOption('excludeTrailingPunctuationFromURLs', true)
    showdown.setOption('literalMidWordUnderscores', true)
    showdown.setOption('literalMidWordAsterisks', true)
  }, [])

  const uid = useParams().uid
  const history = useHistory()
  const [event, setEvent] = useState(null)

  useEffect(() => {
    loadFrom(`events/${uid}`, {}, setEvent)
  }, [uid])

  const update = data => {
    console.log('updating', uid, data)
    postTo(`events/${uid}`, data, setEvent)
  }

  if (!event) return null
  if (!event.note) event.note = {}
  if (!event.vitals) event.vitals = {}

  return <div className='event'>
    <Map lat={event.lat || 0}
         lng={event.lng || 0}
         onChanged={([lat, lng]) => update({ lat, lng })} />
    <When utc={event.utc} tz={event.tz} />
    <div className='container'>
      <h2>Vitals</h2>
      <Vitals vitals={event.vitals} update={update} />
      <h2>Note</h2>
      <Text note={event.note} update={update} />
      <button className='delete' onClick={() => {
        if (confirm('Really delete?')) {
          deleteFrom(`events/${uid}`, () => history.push('/timeline/'))
        }
      }}>🗑️</button>
    </div>
  </div>
}

const Text = ({ note, update }) => {
  const [isEditing, setIsEditing] = useState(false)
  return isEditing
       ? <textarea onBlur={e => { setIsEditing(false); update({ note: e.target.value }) }}
                   defaultValue={note.note || 'Click to edit!'} />
       : <div className='rendered'
              onClick={() => setIsEditing(true)}
              dangerouslySetInnerHTML={{
                __html: new showdown.Converter().makeHtml(note.note || 'Click to edit!')
              }} />
}

export { Event }
