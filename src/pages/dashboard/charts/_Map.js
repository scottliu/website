import React, { useState, useMemo } from 'react'

import { format } from 'd3-format'
import { geoPath, geoAlbersUsa } from 'd3-geo'
import { max } from 'd3-array'
import { scaleSqrt, scaleThreshold } from 'd3-scale'
import { schemeOranges, schemeGreys, schemePurples } from 'd3-scale-chromatic'
import { timeFormat, timeParse } from 'd3-time-format'

import StatesWithPopulation from '../data/_state-populations'

import './map.scss'

// static d3 setup
const margin = {
  bottom: 10,
  left: 10,
  right: 10,
  top: 10,
}
const height = 400
const width = 700
const projection = geoAlbersUsa().fitExtent(
  [
    [margin.left, margin.top],
    [width - margin.right, height - margin.bottom],
  ],
  StatesWithPopulation,
)
const path = geoPath().projection(projection)
// this should be dynamic, espcially with the toggleable fields
// for now there is just a scale for each of the fields.
// const limit = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
const colorLimits = {
  death: [1, 2, 5, 10, 25, 50, 100],
  positive: [50, 100, 250, 500, 1000, 2500, 5000],
  totalTestResults: [100, 250, 500, 1000, 2500, 5000, 10000],
}
/*
const mapColorScale = [
  '#E5A968',
  '#ED9C42',
  '#DC8C3A',
  '#CA7B32',
  '#B96A2A',
  '#A75922',
  '#96491A',
  '#843812',
]
*/
const getColor = {
  death: scaleThreshold(colorLimits.death, schemeGreys[8]),
  positive: scaleThreshold(colorLimits.positive, schemeOranges[8]),
  totalTestResults: scaleThreshold(
    colorLimits.totalTestResults,
    schemePurples[8],
  ),
}

// should be imported from constants file
const colors = {
  totalTestResults: '#696DC2',
  positive: '#E5A968',
  death: '#404856',
}

const formatNumber = format(',.0f')
const formatDate = timeFormat('%b. %d')
const parseDate = timeParse('%Y%m%d')

export default function Map({
  data,
  currentDate,
  currentField,
  useChoropleth,
}) {
  const [hoveredState, setHoveredState] = useState(null)

  const getValue = useMemo(
    () => (d, field = currentField, normalized = false) =>
      ((d.properties.dailyData[currentDate] &&
        d.properties.dailyData[currentDate][field]) ||
        0) / (normalized ? d.properties.population / 1000000 : 1),
    [currentDate, currentField],
  )

  const maxValue = useMemo(
    () => data && max(data.features, d => getValue(d, 'totalTestResults')),
    [data, getValue],
  )

  const r = useMemo(
    () =>
      maxValue &&
      scaleSqrt()
        .domain([0, maxValue])
        .range([0, 50]),
    [maxValue],
  )

  return (
    <div className="map-container">
      {data && !useChoropleth && (
        <BubbleLegend data={data} r={r} maxValue={maxValue} />
      )}
      <svg width={width} height={height}>
        {data && (
          <>
            <States
              geoJson={data}
              useChoropleth={useChoropleth}
              currentDate={currentDate}
              currentField={currentField}
              setHoveredState={setHoveredState}
            />
            {!useChoropleth && (
              <Bubbles geoJson={data} getValue={getValue} r={r} />
            )}
          </>
        )}
      </svg>
      {hoveredState && (
        <Tooltip hoveredState={hoveredState} getValue={getValue} />
      )}
    </div>
  )
}

const States = ({
  geoJson,
  useChoropleth,
  currentDate,
  currentField,
  setHoveredState,
}) => {
  // below function should use getValue
  const getColorFromFeature = d => {
    if (!useChoropleth) return 'white'
    const normalizationPopulation = 1000000 // 1 million;

    const normalizedValue = d.properties.dailyData[currentDate]
      ? d.properties.dailyData[currentDate][currentField] /
        (d.properties.population / normalizationPopulation)
      : 0
    return getColor[currentField](normalizedValue)
  }
  const states = geoJson.features.map(d => (
    <path
      key={`path${d.properties.NAME}`}
      d={path(d)}
      className="countries"
      fill={getColorFromFeature(d)}
      stroke="#ababab"
      onMouseEnter={event => {
        setHoveredState({
          coordinates: [event.pageX, event.pageY],
          state: d,
        })
      }}
      onMouseLeave={() => setHoveredState(null)}
    />
  ))
  return <g>{states}</g>
}

const Bubbles = ({ geoJson, r, getValue }) => {
  if (!r) return null

  // filter out "states" outside of render area (should be hoisted)
  const features = geoJson.features.filter(
    d => d.properties.centroidCoordinates[0],
  )

  const createBubble = (d, i, property) => {
    const props = {
      cx: d.properties.centroidCoordinates[0],
      cy: d.properties.centroidCoordinates[1],
      r: r(getValue(d, property)),
    }
    return (
      <circle
        key={property + i}
        {...props}
        fill={colors[property]}
        stroke={colors[property]}
        fillOpacity={property === 'positive' ? 0.8 : 0.2}
      />
    )
  }
  const testBubbles = features.map((d, i) =>
    createBubble(d, i, 'totalTestResults'),
  )
  const positiveBubbles = features.map((d, i) => createBubble(d, i, 'positive'))
  return (
    <>
      <g id="testBubbles">{testBubbles}</g>
      <g id="positiveBubble">{positiveBubbles}</g>
    </>
  )
}

const BubbleLegend = ({ r, maxValue }) => {
  const formatLegendEntry = d => parseInt(format('.1r')(d), 10)
  const legendData = [
    formatLegendEntry(maxValue * 0.1),
    formatLegendEntry(maxValue * 0.5),
    formatLegendEntry(maxValue),
  ]
  const legendBubbles = legendData.map(d => (
    <circle
      key={`legendBubbles${d}`}
      cx={52}
      cy={145 - r(d)}
      r={r(d)}
      stroke="#ababab"
      fill="none"
    />
  ))
  const legendLines = legendData.map(d => (
    <line
      key={`legendLines${d}`}
      x1={52}
      y1={145 - 2 * r(d)}
      x2={130}
      y2={145 - 2 * r(d)}
      stroke="#ababab"
      strokeDasharray="5 5"
    />
  ))
  const legendText = legendData.map(d => (
    <text key={`legendText${d}`} x={110} y={140 - 2 * r(d)}>
      {formatNumber(d)}
    </text>
  ))
  return (
    <svg width={150} height={150} style={{ overflow: 'visible' }}>
      {legendBubbles}
      {legendLines}
      {legendText}
    </svg>
  )
}

const Tooltip = ({ hoveredState, currentDate, getValue }) => {
  const { coordinates, state } = hoveredState
  const d = state
  const [x, y] = coordinates
  const positive = getValue(d, 'positive')
  const positiveNorm = getValue(d, 'positive', true)
  const totalTestResults = getValue(d, 'totalTestResults')
  const totalTestResultsNorm = getValue(d, 'totalTestResults', true)
  const death = getValue(d, 'death')
  const deathNorm = getValue(d, 'death', true)
  return (
    <div id="map-tooltip" style={{ top: y, left: x }}>
      <table>
        <thead>
          <tr>
            <td colSpan="3">
              {d.properties.NAME}
              <br />
              <span className="date">{formatDate(parseDate(currentDate))}</span>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td />
            <td>Total</td>
            <td>Per capita*</td>
          </tr>
          <tr>
            <td>Tests</td>
            <td>{formatNumber(totalTestResults)}</td>
            <td>{formatNumber(totalTestResultsNorm)}</td>
          </tr>
          <tr>
            <td>Positive tests</td>
            <td>{formatNumber(positive)}</td>
            <td>{formatNumber(positiveNorm)}</td>
          </tr>
          <tr>
            <td>Deaths</td>
            <td>{formatNumber(death)}</td>
            <td>{formatNumber(deathNorm)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export { path }