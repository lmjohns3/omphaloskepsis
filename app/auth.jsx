import React, { createContext, useContext, useState } from 'react'
import { Navigate, useLoaderData, useLocation, useNavigate } from 'react-router-dom'

import { apiUpdate } from './api.jsx'


const AuthContext = createContext({})


const AuthProvider = ({ children }) => {
  const navigate = useNavigate()
  const fetched = useLoaderData()

  const [token, setToken] = useState(null)

  const handleToken = res => {
    document.getElementById('csrf').setAttribute('token', res.csrf)
    setToken(res.aid)
  }

  const clearToken = () => apiUpdate('logout').then(res => {
    document.getElementById('csrf').setAttribute('token', res.csrf)
    setToken(null)
    navigate(0)
  })

  if (!token && fetched) handleToken(fetched)

  return (
    <AuthContext.Provider value={{ token, handleToken, clearToken }}>
      {children}
    </AuthContext.Provider>
  )
}


const AuthRequired = ({ children }) => {
  const { token } = useAuth()
  const location = useLocation()
  return token ? children : <Navigate to='/' replace state={{ then: location }} />
}


const useAuth = () => useContext(AuthContext)


export { AuthProvider, AuthRequired, useAuth }
