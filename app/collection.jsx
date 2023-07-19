import React from 'react'
import { Link, useLoaderData } from 'react-router-dom'

import './collection.styl'


const Collection = () => {
  const collection = useLoaderData()

  return (
    <div className='collection container'>
      <ul>{collection.snapshot_ids.map(
        id => <li><Link to={`/snapshot/${id}/`}>Snapshot</Link></li>
      )}</ul>
    </div>
  )
}


export { Collection }
