import React, { createContext, useContext, useEffect, useState } from 'react'

import { apiUpdate, apiDelete } from './api.jsx'


const AccountContext = createContext(null)


const Account = () => {
  const { account, setAccount } = useContext(AccountContext)

  const update = e => {
    const key = e.name
    const value = e.target?.value
    if (key && value) setAccount(acct => ({ ...acct, [key]: value }))
  }

  return account ? (
    <div className='account container'>
      <h1>Account</h1>
      <label htmlFor='email'>Email</label>
      <input name='email' type='email' onChange={update} value={account.email}></input>
      <label htmlFor='name'>Name</label>
      <input name='name' type='text' onChange={update} value={account.name}></input>
      <label htmlFor='birthday'>Birthday</label>
      <input name='birthday' type='text' onChange={update} value={account.birthday}></input>
    </div>
  ) : <div className='spinner container'>Hold on a sec...</div>
}


export { Account, AccountContext }
