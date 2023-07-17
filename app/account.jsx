import React, { useEffect, useState } from 'react'
import { useLoaderData } from 'react-router-dom'

import { apiUpdate, apiDelete } from './api.jsx'


const Account = () => {
  const account = useLoaderData()

  const update = e => {
    const key = e.target.name
    const value = e.target?.value
    if (key && value) apiUpdate('account', { [key]: value })
  }

  return (
    <div className='account container'>
      <h1>Account</h1>
      <label htmlFor='email'>Email</label>
      <input name='email' type='email' onChange={update} value={account.auth.email}></input>
      <label htmlFor='name'>Name</label>
      <input name='name' type='text' onChange={update} value={account.kv.name}></input>
      <label htmlFor='birthday'>Birthday</label>
      <input name='birthday' type='text' onChange={update} value={account.kv.birthday}></input>
    </div>
  )
}


export { Account }
