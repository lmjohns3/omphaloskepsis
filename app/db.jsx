import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/relativeTime'))

import Dexie from 'dexie'

import { useGeo } from './geo.jsx'


const db = new Dexie('oomph')

db.version(1).stores({
  snapshots: '++id, *tags, utc, lat, lng, exercise.id, habit.id, sleep.id, workout.id',
  sleeps: '++id',
  habits: '++id',
  workouts: '++id',
  exercises: '++id, workout.id',
})


const createSnapshot = async (data = {}) => {
  const id = await db.snapshots.add({
    utc: dayjs.utc().unix(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...data,
  })
  try {
    const geo = await useGeo(200)
    if (geo && geo.coords) {
      db.snapshots.put({ id, lat: geo.coords.latitude, lng: geo.coords.longitude })
    }
  } catch (e) {
    console.log(e)
  }
  return id
}


const createSleep = async () => {
  const id = await createSnapshot()
  await db.snapshots.update(id, { sleepId: await db.sleeps.add() })
  return id
}


export { createSnapshot, db }
