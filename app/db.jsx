import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import Dexie from 'dexie'

import { useGeo } from './geo.jsx'


const db = new Dexie('oomph')


db.version(1).stores({
  settings: '',
  snapshots: '++id, *tags, utc, lat, lng, sleepId, workoutId, *habitIds',
  habits: '++id',  // name, goal, perSeconds
  sleeps: '++id',
  workouts: '++id, name',  // *goals: { ... }
})


db.on('populate', () => db.settings.add({}, 1))


const createSnapshot = async (data = {}) => {
  const id = await db.snapshots.add({
    utc: dayjs.utc().unix(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    snapshotMetrics: {},
    habitIds: [],
    tags: [],
    ...data,
  })
  useGeo().then(geo => {
    if (geo && geo.coords) {
      db.snapshots.update(id, {
        lat: geo.coords.latitude, lng: geo.coords.longitude
      })
    }
  }).catch(console.log)
  return id
}


export { createSnapshot, db }
