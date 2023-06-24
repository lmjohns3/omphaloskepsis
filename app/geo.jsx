import proj4 from 'proj4'
import React from 'react'
import { Map as Leaflet, TileLayer } from 'react-leaflet'

import 'leaflet/dist/leaflet.css'


const geoToUtmConverter = zone => proj4(`+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`).forward


// https://maptools.com/tutorials/grid_zone_details
const getUtmZone = geo => {
  const n = 1 + Math.floor((geo.coords.longitude + 180) / 6)
  const l = 'CDEFGHJKLMNPQRSTUVWX'[Math.floor((geo.coords.latitude + 80) / 8)]
  return `${n}${l}`
}


const Map = ({ lat, lng, zoom, tiles, onChanged }) => {
  const attributions = {
    imagery: ('Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, ' +
              'Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'),
    osm: '© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
    terrain: ('Map tiles by <a href="http://stamen.com">Stamen Design</a>, ' +
              '<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> — ' +
              'Map data © <a href="http://osm.org/copyright">OpenStreetMap</a>'),
    toner: ('Map tiles by <a href="http://stamen.com">Stamen Design</a>, ' +
            '<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> — ' +
            'Map data © <a href="http://osm.org/copyright">OpenStreetMap</a>'),
    watercolor: ('Map tiles by <a href="http://stamen.com">Stamen Design</a>, ' +
                 '<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> — ' +
                 'Map data © <a href="http://osm.org/copyright">OpenStreetMap</a>')
  }; const urls = {
    imagery: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    terrain: 'http://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
    toner: 'http://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png',
    watercolor: 'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.png'
  }
  return (
    <Leaflet center={[lat, lng]}
             zoom={zoom || 10}
             onViewportChanged={onChanged ? vp => onChanged(vp.center) : null}>
      <TileLayer url={urls[tiles || 'imagery']}
                 attribution={attributions[tiles || 'imagery']} />
    </Leaflet>
  )
  // {false ? <Marker position={[lat, lng]}><Popup>Here!</Popup></Marker> : null}
}


const useGeo = (
  timeout = 10 * 1000, // 10 sec
  maximumAge = 5 * 60 * 1000, // 5 min
  enableHighAccuracy = false,
) => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve, reject, { timeout, maximumAge, enableHighAccuracy })
  })
}


export {
  geoToUtmConverter,
  getUtmZone,
  Map,
  useGeo,
}
