import React, { useEffect, useState } from 'react'

const Vitals = ({ vitals, update }) => <div className='vitals'>
  <Polarity value={vitals.polarity || 0} update={update} />
  <div className='mood'>
    <Dial icon='😄' name='happy' value={vitals.happy || 0} update={update} />
    <Dial icon='😢' name='sad' value={vitals.sad || 0} update={update} />
    <Dial icon='😠' name='angry' value={vitals.angry || 0} update={update} />
    <Dial icon='😨' name='afraid' value={vitals.afraid || 0} update={update} />
  </div>
  <Meter update={update} value={vitals?.height_cm} emoji='📏' label='Height'
         attr='height_cm' formats={{ in: 0.3937, cm: null }} />
  <Meter update={update} value={vitals?.weight_kg} emoji='⚖️' label='Weight'
         attr='weight_kg' formats={{ lb: 2.20462, st: 0.15747, kg: null }} />
  <Meter update={update} value={vitals?.temperature_degc} emoji='🌡️' label='Temp'
         attr='temperature_degc' formats={{ '°C': null, '°F': [
           degc => degc * 1.8 + 32, degf => (degf - 32) / 1.8]}} />
  <Meter update={update} value={vitals?.sitting_hr_bpm} emoji='🫀️' label='Pulse'
         attr='sitting_hr_bpm' formats={{ bpm: null, Hz: 1 / 60 }} />
  <Meter update={update} value={vitals?.vo2_max} emoji='🫁' label='V02 max' attr='vo2_max'
         formats={{ 'mL/(kg·min)': null }} />
</div>

const Polarity = ({ value, update }) => {
  const handle = e => {
    const { width } = e.target.getBoundingClientRect(); const x = e.nativeEvent.offsetX
    update({ polarity: Math.max(-1.0, Math.min(1.0, 2 * x / width - 1)) })
  }
  return <div className='polarity'>
    <span className='bar' onClick={handle}></span>
    <span className='marker cur'
          style={{ left: `${Math.round(50 * (1 + value))}%` }}>📍</span>
    <span className='marker lo'>🙍</span>
    <span className='marker hi'>🙋</span>
  </div>
}

const Dial = ({ icon, name, value, update }) => {
  const levels = 20
  const range = 1.3333 * Math.PI
  const offset = (Math.PI + range) / 2
  const level2angle = lev => offset - lev / levels * range
  const angle2level = ang => Math.round((offset - ang) % (2 * Math.PI) / range * levels)

  const levs = [...Array(1 + Math.max(0, Math.round(levels * value))).keys()]
  const angles = levs.map(l => level2angle(l))
  const outer = angles.map(a => `${50 + 50 * Math.cos(a)}% ${50 - 50 * Math.sin(a)}%`)
  const inner = angles.map(a => `${50 + 35 * Math.cos(a)}% ${50 - 35 * Math.sin(a)}%`)
  const points = [...outer, ...inner.reverse()]

  const handle = e => {
    const { width, height } = e.target.getBoundingClientRect()
    const x = e.nativeEvent.offsetX; const y = e.nativeEvent.offsetY
    const angle = Math.atan2(1 - 2 * y / height, 2 * x / width - 1)
    const level = angle2level(angle)
    update({ [name]: Math.max(0.0, Math.min(1.0, level / levels)) })
  }

  return <div className='dial'>
    <span className={`arc level ${name}`}
          style={{ clipPath: `polygon(${points.join(', ')})` }}></span>
    <span className='arc range' onClick={handle}></span>
    <span className='icon'>{icon}</span>
    <span className='value'>{Math.round(100 * value)}%</span>
  </div>
}

const Meter = ({ attr, value, label, emoji, formats, update }) => {
  const [editing, setEditing] = useState(false)

  if (!formats) formats = { '': null }

  const units = Object.keys(formats)
  const unitStorageKey = `omphalos-unit-${attr}`
  const [unit, setUnit] = useState(localStorage.getItem(unitStorageKey))

  useEffect(() => {
    if (units.indexOf(unit) < 0) setUnit(units.find(u => formats[u] === null))
  }, [unit, units])

  const convertToDisplay = v => {
    const factor = formats[unit]
    return !factor ? v : factor.length ? factor[0](v) : v * factor
  }

  const convertFromDisplay = v => {
    const factor = formats[unit]
    return !factor ? v : factor.length ? factor[1](v) : v / factor
  }

  const storedValue = value
  const displayedValue = convertToDisplay(storedValue)

  return <div className='meter'>
    <span className='label'>{label || attr}</span>
    {!emoji ? null : <span className='emoji'>{emoji}</span>}
    <span className={`value ${update ? 'can-edit' : ''}`}
          onClick={update ? () => setEditing(true) : null}>{
            !editing ? !storedValue ? '---' : roundTenths(displayedValue)
                     : <input type='text' defaultValue={displayedValue} autoFocus
                              onFocus={e => e.target.select()} onBlur={e => {
                                setEditing(false)
                                update({ [attr]: convertFromDisplay(e.target.value) })
                              } } />
    }</span>
    <span className={`unit options-${units.length}`} onClick={() => setUnit(u => {
      const i = units.indexOf(u)
      const next = units[(i + 1) % units.length]
      localStorage.setItem(unitStorageKey, next)
      return next
    })}>{unit}</span>
  </div>
}

export {
  Meter,
  Vitals,
}
