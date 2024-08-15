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
  workouts: '++id, &name',  // *goals: { ... }
  exercises: '++id, &name, *tags',
})


db.on('populate', async () => {
  db.settings.add({}, 1)

  const base = await (await fetch('base.json')).json()

  const exercises_ = Object.entries(base.exercises).map(([key, value]) => ({ name: key, ...value }))
  await db.exercises.bulkAdd(exercises_)
  const exercises = Object.fromEntries((await db.exercises.toArray()).map(e => ([e.name, e])))

  await db.workouts.bulkAdd(
    Object.entries(base.workouts).map(([name, exs]) => {
      const goals = exs.map(ex => {
        if (!exercises[ex]) console.error('base exercise not found!', ex)
        return { id: exercises[ex].id }
      })
      return { name, goals }
    })
  )
})


const createSnapshot = async (data = {}) => {
  const id = await db.snapshots.add({
    utc: dayjs.utc().unix(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    metrics: {},
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
