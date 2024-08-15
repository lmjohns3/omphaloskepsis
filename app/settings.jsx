import { useLiveQuery } from 'dexie-react-hooks'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import { Delete } from './common.jsx'
import { db } from './db.jsx'

import './settings.styl'


export default () => {
  const navigate = useNavigate()
  const settings_ = useLiveQuery(() => db.settings.toArray())
  if (!settings_) return null
  const settings = settings_[0]

  return (
    <div className='settings container'>
      <h2>Settings</h2>
      <div>
        <h3>Calculations</h3>
        <p className='blurb'>
          Published calculations for maximum heart rate, VO<sub>2</sub> max, and so forth use age and sex as inputs.
          If you'd like to use these, enter your approximate birthday and select either male or female.
        </p>
        <p className='flex-row'>
          <label htmlFor='birthday'>Birthday</label>
          <input type='date'
                 name='birthday'
                 defaultValue={settings?.birthday}
                 onChange={e => db.settings.update(1, { birthday: e.target.value })} />
        </p>
        <p className='flex-row'>
          <label htmlFor='sex'>Sex</label>
          <select name='sex'
                  defaultValue={settings?.sex}
                  onChange={e => db.settings.update(1, { sex: e.target.value })}>
            <option value=''>Unspecified</option>
            <option value='f'>Female</option>
            <option value='m'>Male</option>
          </select>
        </p>
      </div>
      <Delete onClick={() => db.delete({ disableAutoOpen: false }).then(() => navigate('/'))} />
    </div>
  )
}
