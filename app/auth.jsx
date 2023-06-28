import React, { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { apiPost } from './api.jsx'


const AuthContext = createContext({})


const AuthProvider = ({ children }) => {
  const navigate = useNavigate()

  const [token, setToken] = useState(null)
  const [ready, setReady] = useState(false)

  const handleToken = res => {
    setToken(res.aid)
    document.getElementById('csrf').setAttribute('content', res.csrf)
  }

  const clearToken = () => apiPost('logout').then(() => {
    setToken(null)
    navigate('/')
  })

  useEffect(() => {
    apiPost('token').then(handleToken).finally(() => setReady(true))
  }, [])

  return (
    <AuthContext.Provider value={{ ready, token, handleToken, clearToken }}>
      {children}
    </AuthContext.Provider>
  )
}


const AuthRequired = ({ children }) => {
  const { ready, token } = useAuth()
  const location = useLocation()

  if (!ready) return null
  if (token) return children
  return <Navigate to={`/login?then=${location.pathname}`} replace />
}


const useAuth = () => useContext(AuthContext)


export { AuthProvider, AuthRequired, useAuth }
