import React from 'react'
import { Map as Leaflet, TileLayer } from 'react-leaflet'

import 'leaflet/dist/leaflet.css'

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
  return <Leaflet center={[lat, lng]}
                  zoom={zoom || 10}
                  onViewportChanged={onChanged ? vp => onChanged(vp.center) : null}>
    <TileLayer url={urls[tiles || 'imagery']}
               attribution={attributions[tiles || 'imagery']} />
  </Leaflet>
  // {false ? <Marker position={[lat, lng]}><Popup>Here!</Popup></Marker> : null}
}

const withGeo = (
  callback,
  timeout = 15 * 1000, // 15 sec
  maximumAge = 5 * 60 * 1000, // 5 min
  enableHighAccuracy = false
) => {
  return callback({ lat: 37.9096, lng: -122.6961 })
  navigator.geolocation.getCurrentPosition(
    geo => {
      const c = geo.coords
      callback({
        lat: c.latitude,
        lng: c.longitude,
        acc: c.accuracy,
        alt: c.altitude,
        heading: c.heading,
        speed: c.speed,
        ...c
      })
    },
    console.log,
    { timeout, maximumAge, enableHighAccuracy })
}

export {
  Map,
  withGeo,
}
