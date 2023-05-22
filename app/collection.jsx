import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRead } from './api.jsx'
import { Map } from './geo.jsx'

import './collection.styl'


const Collection = () => {
  const id = parseInt(useParams().id, 36)
  const [collection, setCollection] = useState({})

  useEffect(() => { apiRead(`collections/${id}`).then(setCollection) }, [])

  return <div className='collection'>
    {collection.snapshots.map(snapshot => <Snapshot key={snapshot.id} snapshot={snapshot} />)}
  </div>
}


const Snapshot = ({ snapshot }) => {
  return <div className='snapshot'>
    {snapshot.note}
  </div>
}


export { Collection }
