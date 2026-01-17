import { useEffect, useMemo, useRef, useState } from 'react'
import { DataGrid, DataTable } from '@highcharts/dashboards/datagrid'
import '@highcharts/dashboards/css/datagrid.css'

import eventThumb from '../assets/531707773106aaeea35935fa871cb6ce18f9f84f.png'
import grandRaidLogo from '../assets/da2a1ce5e69564e56a29b5912fd151a8f515e136.png'
import './EventsColumnFilteringChart.css'

type EventsColumnFilteringChartProps = {
  events: Array<{
    id: string
    name: string
    country: string
    startLabel: string
    imageUrl?: string
    courses: Array<{ id: string; name: string }>
  }>
  onEventSelect?: (eventId: string) => void
}

export default function EventsColumnFilteringChart({
  events,
  onEventSelect,
}: EventsColumnFilteringChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<InstanceType<typeof DataGrid> | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const pageSize = 15
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize))
  const pagedEvents = useMemo(() => {
    const start = pageIndex * pageSize
    return events.slice(start, start + pageSize)
  }, [events, pageIndex])

  useEffect(() => {
    if (!containerRef.current) return

    // Nettoyage défensif pour éviter un double rendu en mode Strict.
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }

    const eventImages = pagedEvents.map((event, index) => {
      if (event.imageUrl) return event.imageUrl
      return index === 0 ? grandRaidLogo : eventThumb
    })

    // On initialise la grille Highcharts "Column Filtering".
    const dataTable = new DataTable({
      columns: {
        Nom: pagedEvents.map((event, index) => `${event.id}-${index}`),
        Pays: pagedEvents.map((event) => event.country),
        'Début': pagedEvents.map((event) => event.startLabel),
        'Nombre de course': pagedEvents.map((event) => event.courses.length),
        Options: pagedEvents.map(() => '⋯'),
      },
    })

    const gridOptions = {
      dataTable,
      cellHeight: 65,
      editable: false,
      resizableColumns: false,
      useHTML: true,
      columnDefaults: {
        filtering: {
          enabled: true,
          inline: false,
        },
      },
      columns: {
        Nom: {
          cellFormatter: function () {
            const value = String((this as unknown as { value?: string }).value ?? '')
            const index = Number(value.split('-').pop() || 0)
            const image = eventImages[index] || eventImages[0]
            const title = pagedEvents[index]?.name ?? 'Sans titre'
            const eventId = pagedEvents[index]?.id ?? ''
            return `<div class="events-grid__name" data-event-id="${eventId}"><span class="events-grid__thumb"><img src="${image}" alt="" /></span><span>${title}</span></div>`
          },
        },
        Pays: {},
        'Début': {},
        'Nombre de course': {},
        Options: {
          headerFormat: '',
          cellFormatter: function () {
            return '<button class="events-grid__options" type="button" aria-label="Options">⋯</button>'
          },
        },
      },
    }

    gridRef.current = new DataGrid(containerRef.current, gridOptions as any)

    const handleRowClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const rowEl = target?.closest<HTMLElement>('.highcharts-datagrid-row')
      if (!rowEl || !containerRef.current) return

      const rows = Array.from(containerRef.current.querySelectorAll('.highcharts-datagrid-row'))
      const rowIndex = rows.indexOf(rowEl)
      if (rowIndex < 0) return

      const selected = pagedEvents[rowIndex]
      if (selected?.id) {
        onEventSelect?.(selected.id)
      }
    }

    containerRef.current.addEventListener('click', handleRowClick)

    return () => {
      const gridInstance = gridRef.current as { destroy?: () => void } | null
      if (gridInstance?.destroy) {
        gridInstance.destroy()
      }
      gridRef.current = null
      containerRef.current?.removeEventListener('click', handleRowClick)
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [pagedEvents, onEventSelect])

  useEffect(() => {
    if (pageIndex >= totalPages) {
      setPageIndex(0)
    }
  }, [pageIndex, totalPages])

  useEffect(() => {
    setPageIndex(0)
  }, [events])

  return (
    <div className="events-chart">
      <div className="events-chart__container" ref={containerRef} />
      <div className="events-chart__pagination" role="navigation" aria-label="Pagination">
        {Array.from({ length: totalPages }).map((_, index) => (
          <button
            key={`page-${index}`}
            type="button"
            className={`events-chart__dot${index === pageIndex ? ' events-chart__dot--active' : ''}`}
            onClick={() => setPageIndex(index)}
            aria-label={`Page ${index + 1}`}
            aria-current={index === pageIndex ? 'page' : undefined}
          />
        ))}
      </div>
    </div>
  )
}
