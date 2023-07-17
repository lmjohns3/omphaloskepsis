import React, { useEffect, useContext, useRef, useState } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'

import { apiUpdate } from './api.jsx'
import { useAuth } from './auth.jsx'

import './login.styl'

// https://html.spec.whatwg.org/multipage/input.html#e-mail-state-(type%3Demail)
const validEmailPattern = new RegExp(/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)


const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, handleToken } = useAuth()

  const emailInput = useRef(null)
  const passwordInput = useRef(null)

  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [needsEmail, setNeedsEmail] = useState(true)
  const [isValidEmail, setIsValidEmail] = useState(false)

  useEffect(() => { setIsValidEmail((validEmailPattern.test(email))) }, [email])

  useEffect(() => {
    const ref = (needsEmail ? emailInput : passwordInput).current
    if (ref) ref.focus()
  }, [needsEmail])

  const onSubmit = e => {
    e.preventDefault()
    setError(null)
    apiUpdate('login', { email, password })
      .then(handleToken)
      .then(() => navigate(location.state?.then ?? '/'))
      .catch(err => { setPassword(''); setError('Incorrect!') })
  }

  if (token) return <Navigate to={location.state?.then ?? '/'} />

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
