import dayjs from 'dayjs'
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/duration'))
dayjs.extend(require('dayjs/plugin/minMax'))

import dwt from 'discrete-wavelets'


// Compute mean, standard deviation, and rms values of an array. See Welford's
// online algorithm at https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance
const stats = xs => {
  const count = xs.length
  const acc = xs.reduce((x, acc) => {
    const n = acc.n + 1
    const d1 = x - acc.m
    const m = acc.m + d1 / n
    const d2 = x - m
    return { n, m, m2: acc.m2 + d1 * d2, s2: acc.s2 + x * x }
  }, { n: 0, m: 0, m2: 0, s2: 0 })
  return {
    count: count,
    mean: acc.m,
    stdev: acc.m2 / count,
    rms: Math.sqrt(acc.s2 / count)
  }
}

// Return an array of sample differences from an array of values xs.
const diff = xs => xs.map((x, i) => i ? x - xs[i - 1] : 0)

// Return the cumulative sum of an array.
const cumsum = xs => xs.reduce((acc, x) => [...acc, acc.slice(-1) + x], [0])


export default {

  roundTenths: x => x.toLocaleString(
    undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 }),

  // Heart rate variability metrics; see ncbi.nlm.nih.gov/pmc/articles/PMC5624990/
  sdrr: rrIntervals => stats(rrIntervals).stdev,
  rmssd: rrIntervals => stats(diff(rrIntervals)).rms,

  // Return heart rate in beats/min, at 1Hz samples.
  heartRateSequence: rrIntervals => {
    const elapsed = cumsum(rrIntervals)
    let i = 0
    return Array.from({ length: elapsed.length }, (_, t) => {
      let j = i
      while (elapsed[j] <= t) j++
      // 60000 [msec / min] / rrIntervals[msec / beat]
      const lo = 60000 / rrIntervals[i - 1]
      const hi = 60000 / rrIntervals[i]
      const a = (t - elapsed[i - 1]) / (elapsed[i] - elapsed[i - 1])
      return (1 - a) * lo + a * hi
    })
  },

  // Cumulative metabolic energy, computed from instantaneous heart rate
  // measurements, over the course of the recording -- from Keytel et al. (2005
  // https://ncbi.nlm.nih.gov/pubmed/15966347), see also Rennie et al. (2001
  // https://ncbi.nlm.nih.gov/pubmed/11404659) & Hiilloskorpi et al. (1999
  // https://thieme-connect.com/products/ejournals/html/10.1055/s-1999-8829)
  cumulativeEnergyJ: (bpm, age, male, vo2max, weight) => {
    let intercept, slope
    if (vo2max && male) {
      slope = 0.6344
      intercept = -95.7735 + 0.3942 * weight + 0.4044 * vo2max + 0.2713 * age
    } else if (vo2max) {
      slope = 0.4498
      intercept = -59.3954 + 0.1032 * weight + 0.3802 * vo2max + 0.2735 * age
    } else if (male) {
      slope = 0.6309
      intercept = -55.0969 + 0.1988 * weight + 0.2017 * age
    } else {
      slope = 0.4472
      intercept = -20.4022 + -0.1263 * weight + 0.0740 * age
    }

    // The Keytel formula yields kj/min for each heart rate sample. We convert
    // [kj/min] / 60[sec/min] ==> [kj/sec] * 1000 [j/kj] ==> [j/sec]. Our samples
    // are spaced at 1/sec, so the sum gives us cumulative energy in joules.
    return cumsum(bpm.map(x => (x * slope + intercept) * 1000 / 60))
  },

  waveletEncode: (data, prune) => {
    return dwt.wavedec(data, 'haar').slice(0, prune).flat()
  },

  waveletDecode: (coeffs, n) => {
    if (!coeffs || !n) return []
    const tree = [[coeffs.shift()]]
    n -= 1
    let i = 1
    while (coeffs.length > 0) {
      tree.push(coeffs.splice(0, i))
      n -= i
      i *= 2
    }
    while (n > 0) {
      tree.push(Array(i).fill(0, 0))
      n -= i
      i *= 2
    }
    return dwt.waverec(tree, 'haar').slice(0, n)
  },

  formatDuration: s => {
    return dayjs.duration(parseInt(1000 * s))
      .toISOString()
      .replace(/[PT]/g, '')
      .toLowerCase()
      .replace(/([ymdh])/ig, '$1 ')
      .replace(/\s+$/, '')
  },

  parseDuration: s => dayjs.duration(
    /^\d+$/.test(s)
      ? `PT${s}S`
      : `PT${s.replace(/\s+/g, '').toUpperCase()}`
  ).as('s'),

  shuffle: arr => {
    for (let i = 0; i < arr.length; i++) {
      const j = arr.length - 1 - Math.floor(i * Math.random())
      const t = arr[i]
      arr[i] = arr[j]
      arr[j] = t
    }
    return arr
  },
}
