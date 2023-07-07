import React, { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLoaderData, useLocation, useNavigate } from 'react-router-dom'

import { apiUpdate } from './api.jsx'


const AuthContext = createContext({})


const AuthProvider = ({ children }) => {
  const navigate = useNavigate()
  const tokenResponse = useLoaderData()

  const [token, setToken] = useState(null)

  const handleToken = res => {
    setToken(res.aid)
    document.getElementById('csrf').setAttribute('content', res.csrf)
  }

  const clearToken = () => apiUpdate('logout').then(res => {
    setToken(null)
    document.getElementById('csrf').setAttribute('content', res.csrf)
    navigate('/')
  })

  if (!token && tokenResponse) handleToken(tokenResponse)

  return (
    <AuthContext.Provider value={{ token, handleToken, clearToken }}>
      {children}
    </AuthContext.Provider>
  )
}


const AuthRequired = ({ children }) => {
  const { token } = useAuth()
  const location = useLocation()
  if (token) return children
  return <Navigate to={`/login?then=${location.pathname}`} replace />
}


const useAuth = () => useContext(AuthContext)


export { AuthProvider, AuthRequired, useAuth }
