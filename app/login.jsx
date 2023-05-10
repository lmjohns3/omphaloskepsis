import React, { useEffect, useContext, useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'

import { apiPost } from './api.jsx'
import { AccountContext } from './account.jsx'

import './login.styl'

// https://html.spec.whatwg.org/multipage/input.html#e-mail-state-(type%3Demail)
const validEmailPattern = new RegExp(/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)


const Login = () => {
  const history = useHistory()
  const emailInput = useRef(null)
  const passwordInput = useRef(null)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [needsEmail, setNeedsEmail] = useState(true)
  const [isValidEmail, setIsValidEmail] = useState(false)
  const { setAccount } = useContext(AccountContext)

  useEffect(() => { setIsValidEmail((validEmailPattern.test(email))) }, [email])

  useEffect(() => {
    if (passwordInput.current && !needsEmail) passwordInput.current.focus()
  }, [passwordInput.current, needsEmail])

  useEffect(() => {
    if (emailInput.current && needsEmail) emailInput.current.focus()
  }, [emailInput.current, needsEmail])

  const onSubmit = e => {
    e.preventDefault()
    setError(null)
    apiPost('login', { email, password })
      .then(res => {
        document.getElementById('csrf-token').setAttribute('content', res.csrf)
        setAccount(res.account)
        history.push('/timeline/')
      })
      .catch(err => {
        setPassword('')
        setError('Better luck next time!')
      })
  }

  return (
    <div className='login container'>
      <h1>Welcome!</h1>
      {error ? <div className='error'>{error}</div> : null}
      <input ref={emailInput}
             type='email'
             placeholder='Enter your email to start'
             autoFocus
             value={email}
             onChange={e => setEmail(e.target.value)}></input>
      {needsEmail ?
       <button disabled={!isValidEmail} onClick={() => setNeedsEmail(false)}>Continue</button> :
       <form onSubmit={onSubmit}>
         <input ref={passwordInput}
                type='password'
                placeholder='Password'
                value={password}
                onChange={e => setPassword(e.target.value)}></input>
         <button type='submit'>Log In</button>
       </form>}
    </div>
  )
}


const Logout = () => {
  const history = useHistory()
  const { setAccount } = useContext(AccountContext)

  useEffect(() => {
    apiPost('logout').then(() => {
      setAccount(null)
      history.replace('/')
    })
  }, [])

  return <div className='logout'></div>
}


export { Login, Logout }
