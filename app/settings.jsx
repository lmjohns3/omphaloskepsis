import { useLiveQuery } from 'dexie-react-hooks'
import React from 'react'
import { useNavigate } from 'react-router-dom'


import { Delete } from './common.jsx'
import { db } from './db.jsx'


export default () => {
  const navigate = useNavigate()
  const settings_ = useLiveQuery(() => db.settings.toArray())
  if (!settings_) return null
  const settings = settings_[0]

  return (
    <div className='container'>
      <h1>Settings</h1>

      <label htmlFor='birthday'>Birthday</label>
      <input type='date'
             name='birthday'
             defaultValue={settings?.birthday}
             onChange={e => db.settings.update(1, { birthday: e.target.value })} />

      <label htmlFor='sex'>Sex</label>
      <input type='checkbox'
             name='sex'
             defaultValue={settings?.sex}
             onChange={e => db.settings.update(1, { sex: e.target.value })} />

      <Delete onClick={() => db.delete({ disableAutoOpen: false }).then(() => navigate('/'))} />
    </div>
  )
}
