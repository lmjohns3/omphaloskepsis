import React, { useEffect, useContext, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { apiPost } from './api.jsx'
import { useAuth } from './auth.jsx'

import './login.styl'

// https://html.spec.whatwg.org/multipage/input.html#e-mail-state-(type%3Demail)
const validEmailPattern = new RegExp(/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)


const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { handleToken } = useAuth()

  const emailInput = useRef(null)
  const passwordInput = useRef(null)

  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [needsEmail, setNeedsEmail] = useState(true)
  const [isValidEmail, setIsValidEmail] = useState(false)

  useEffect(() => { setIsValidEmail((validEmailPattern.test(email))) }, [email])

  useEffect(() => { (needsEmail ? emailInput : passwordInput).current.focus() }, [needsEmail])

  const onSubmit = e => {
    e.preventDefault()
    setError(null)
    apiPost('login', { email, password })
      .then(handleToken)
      .then(() => navigate(location.search.replace(/.*\bthen=([^&]+).*/, '$1') || '/timeline/'))
      .catch(err => { setPassword(''); setError('Incorrect!') })
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


export { Login }
