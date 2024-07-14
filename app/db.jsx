import Dexie from 'dexie'

export default db = new Dexie('oomph')

db.version(1).stores({
  snapshots: '++id, utc, tz, lat, lng',  // vitals, mood, note
  collections: '++id, *tags',  // *snapshot-ids
  habits: '++id',  // title, goal-completions, goal-per-n-seconds, *completion-snapshot
  workouts: '++id',  // title?, *[ exercise, goal-reps, goal-..., completed-snapshot, completed-reps, completed-... ]
  exercises: '++id, *tags',  // title, howto-video, howto-text
})
