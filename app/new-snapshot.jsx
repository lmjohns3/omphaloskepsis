import { useNavigate } from 'react-router-dom'

import { createSnapshot } from './db.jsx'


export default () => {
  const navigate = useNavigate()

  createSnapshot().then(id => navigate(`/snapshot/${id}/`))

  return null
}
