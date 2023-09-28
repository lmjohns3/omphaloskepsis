import React, { useEffect, useState } from 'react'
import { useLoaderData } from 'react-router-dom'

import { apiUpdate, apiDelete } from './api.jsx'

import './account.styl'


const Account = () => {
  const account = useLoaderData()

  const [needsSaving, setNeedsSaving] = useState(false)
  const [kvs, setKvs] = useState(account.kv ?? {})

  const update = key => e => {
    setNeedsSaving(true)
    setKvs(kv => ({ ...kv, [key]: e.target.value }))
  }

  return (
    <div className='account container'>
      <h1>Account</h1>
      <label htmlFor='name'>Name</label>
      <input name='name' type='text' onChange={update('name')} value={kvs.name}></input><br/>
      <label htmlFor='birthday'>Birthday</label>
      <input name='birthday' type='date' onBlur={update('birthday')} defaultValue={kvs.birthday}></input><br/>
      <label htmlFor='save'></label>
      <button disabled={!needsSaving}
              onClick={() => apiUpdate('account', kvs).then(() => setNeedsSaving(false))}>Save</button>
      <h1>Security</h1>
      {account.auth.email}<br/>
      <label htmlFor='password'>Password</label>
      <input name='password' type='password'></input><br/>
    </div>
  )
}


export { Account }
