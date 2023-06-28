import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { apiRead } from './api.jsx'
import { Map } from './geo.jsx'

import './collection.styl'


const Collection = () => {
  const id = parseInt(useParams().id, 36)
  const [collection, setCollection] = useState(null)

  useEffect(() => { apiRead(`collection/${id}`).then(setCollection) }, [])

  if (!collection) return null

  return (
    <div className='collection'>
      {collection.snapshots.map(snap => <Snapshot key={snap.id} snapshot={snap} />)}
    </div>
  )
}


const Snapshot = ({ snapshot }) => {
  const navigate = useNavigate()

  return (
    <div className='snapshot' onClick={() => navigate(`/snapshot/${snapshot.id.toString(36)}/`)}>
      {snapshot.utc}
      {snapshot.note}
    </div>
  )
}


export { Collection }
