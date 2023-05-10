import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRead } from './api.jsx'
import { Map } from './geo.jsx'

import './collection.styl'

const Collection = () => {
  const id = useParams().id
  const [collection, setCollection] = useState({})
  const [snapshots, setSnapshots] = useState([])

  useEffect(() => {
    apiRead(`collections/${id}`).then(setCollection)
    apiRead(`collections/${id}/snapshots`).then(setSnapshots)
  }, [])

  return <div className='collection'>
    {snapshots.map(snapshot => <Snapshot key={snapshot.id} snapshot={snapshot} />)}
  </div>
}

const Snapshot = ({ snapshot }) => {
  return <div className='snapshot'>
    {snapshot.note}
  </div>
}

export { Collection }
