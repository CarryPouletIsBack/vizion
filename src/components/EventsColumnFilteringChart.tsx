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
  onEventEdit?: (eventId: string) => void
  onEventDelete?: (eventId: string) => void
}

export default function EventsColumnFilteringChart({
  events,
  onEventSelect,
  onEventEdit,
  onEventDelete,
}: EventsColumnFilteringChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<InstanceType<typeof DataGrid> | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState<{ eventId: string; x: number; y: number } | null>(null)
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
                        // Utiliser un attribut data-* valide pour Highcharts
                        return `<div class="events-grid__name" data-eventid="${eventId}"><span class="events-grid__thumb"><img src="${image}" alt="" /></span><span>${title}</span></div>`
                      },
                    },
        Pays: {},
        'Début': {},
        'Nombre de course': {},
        Options: {
          headerFormat: '',
          cellFormatter: function () {
            const value = String((this as unknown as { value?: string }).value ?? '')
            const index = Number(value.split('-').pop() || 0)
            const eventId = pagedEvents[index]?.id ?? ''
            return `<div class="events-grid__options-wrapper" data-eventid="${eventId}"><button class="events-grid__options" type="button" aria-label="Options" data-eventid="${eventId}">⋯</button></div>`
          },
        },
      },
    }

    gridRef.current = new DataGrid(containerRef.current, gridOptions as any)

    // Gestionnaire pour les clics sur les boutons d'options
    const handleOptionsClick = (event: Event) => {
      const mouseEvent = event as MouseEvent
      const target = mouseEvent.target as HTMLElement | null
      
      // Vérifier si on clique sur le bouton ou son wrapper
      const optionsButton = target?.closest<HTMLElement>('.events-grid__options')
      const optionsWrapper = target?.closest<HTMLElement>('.events-grid__options-wrapper')
      
      if (optionsButton || optionsWrapper) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        
        const element = optionsButton || optionsWrapper
        if (element) {
          const eventId = element.getAttribute('data-eventid')
          if (eventId) {
            const rect = element.getBoundingClientRect()
            // Positionner le menu sous le bouton, centré
            setMenuOpen({ eventId, x: rect.left + rect.width / 2 - 60, y: rect.bottom + 4 })
          }
        }
        return true
      }
      return false
    }

    // Gestionnaire pour les clics sur les lignes (sauf colonne Options)
    const handleRowClick = (event: Event) => {
      const mouseEvent = event as MouseEvent
      const target = mouseEvent.target as HTMLElement | null
      
      // Ignorer si on clique sur les options ou le menu
      if (target?.closest('.events-grid__options') || 
          target?.closest('.events-grid__options-wrapper') ||
          target?.closest('.events-grid__menu')) {
        return
      }

      // Vérifier si on clique dans la dernière colonne (Options)
      const cell = target?.closest<HTMLElement>('.highcharts-datagrid-cell')
      if (cell) {
        const row = cell.closest<HTMLElement>('.highcharts-datagrid-row')
        if (row && containerRef.current) {
          const cells = Array.from(row.querySelectorAll('.highcharts-datagrid-cell'))
          if (cells.indexOf(cell) === cells.length - 1) {
            // C'est la colonne Options - ne pas ouvrir l'événement
            return
          }
        }
      }

      // Ouvrir l'événement
      const rowEl = target?.closest<HTMLElement>('.highcharts-datagrid-row')
      if (!rowEl || !containerRef.current) return

      const rows = Array.from(containerRef.current.querySelectorAll('.highcharts-datagrid-row'))
      const rowIndex = rows.indexOf(rowEl)
      if (rowIndex >= 0 && rowIndex < pagedEvents.length) {
        const selected = pagedEvents[rowIndex]
        if (selected?.id) {
          onEventSelect?.(selected.id)
        }
      }
    }

    // Ajouter les gestionnaires avec capture phase - options en premier pour avoir la priorité
    containerRef.current.addEventListener('click', handleOptionsClick, { capture: true, passive: false })
    containerRef.current.addEventListener('click', handleRowClick, { capture: true, passive: false })
    
    // Ajouter aussi un gestionnaire directement sur les boutons après le rendu
    const timeoutId = setTimeout(() => {
      if (containerRef.current) {
        const optionsElements = containerRef.current.querySelectorAll('.events-grid__options, .events-grid__options-wrapper')
        optionsElements.forEach((element) => {
          const clickHandler = (e: Event) => {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            handleOptionsClick(e)
          }
          element.addEventListener('click', clickHandler, { capture: true, passive: false })
          element.addEventListener('mousedown', (e) => {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
          }, { capture: true, passive: false })
        })
      }
    }, 300)
    
    // Fermer le menu si on clique ailleurs
    const handleOutsideClick = (event: Event) => {
      const mouseEvent = event as MouseEvent
      const clickTarget = mouseEvent.target as HTMLElement | null
      if (!clickTarget?.closest('.events-grid__menu') && !clickTarget?.closest('.events-grid__options')) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('click', handleOutsideClick)

    return () => {
      clearTimeout(timeoutId)
      const gridInstance = gridRef.current as { destroy?: () => void } | null
      if (gridInstance?.destroy) {
        gridInstance.destroy()
      }
      gridRef.current = null
      containerRef.current?.removeEventListener('click', handleOptionsClick, { capture: true } as any)
      containerRef.current?.removeEventListener('click', handleRowClick, { capture: true } as any)
      if (containerRef.current) {
        const optionsElements = containerRef.current.querySelectorAll('.events-grid__options, .events-grid__options-wrapper')
        optionsElements.forEach((element) => {
          // Supprimer tous les listeners
          const newElement = element.cloneNode(true)
          element.parentNode?.replaceChild(newElement, element)
        })
      }
      document.removeEventListener('click', handleOutsideClick)
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

  const handleEdit = (eventId: string) => {
    setMenuOpen(null)
    onEventEdit?.(eventId)
  }

  const handleDelete = (eventId: string) => {
    setMenuOpen(null)
    if (confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
      onEventDelete?.(eventId)
    }
  }

  return (
    <div className="events-chart">
      <div className="events-chart__container" ref={containerRef} />
      {menuOpen && (
        <div
          className="events-grid__menu"
          style={{
            position: 'fixed',
            left: `${menuOpen.x}px`,
            top: `${menuOpen.y}px`,
            zIndex: 1000,
          }}
        >
          <button
            type="button"
            className="events-grid__menu-item"
            onClick={() => handleEdit(menuOpen.eventId)}
          >
            Éditer
          </button>
          <button
            type="button"
            className="events-grid__menu-item events-grid__menu-item--danger"
            onClick={() => handleDelete(menuOpen.eventId)}
          >
            Supprimer
          </button>
        </div>
      )}
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
