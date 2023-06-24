import React, { useEffect, useState } from 'react'
import { useHistory, useParams } from 'react-router-dom'

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
  const history = useHistory()

  return (
    <div className='snapshot' onClick={() => history.push(`/snapshot/${snapshot.id.toString(36)}/`)}>
      {snapshot.utc}
      {snapshot.note}
    </div>
  )
}


export { Collection }
