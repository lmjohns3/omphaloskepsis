import { useNavigate } from 'react-router-dom'

import { createSnapshot, db } from './db.jsx'


export default () => {
  const navigate = useNavigate()

  db.sleeps.add({}).then(id => createSnapshot({ sleepId: id })).then(id => navigate(`/snapshot/${id}/`))

  return null
}
