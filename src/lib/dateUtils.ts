/**
 * Fusionne la date de la course et l'heure de départ en un objet Date pour le moteur physique.
 * @param dateCourse Format YYYY-MM-DD (ex: "2024-08-30")
 * @param heureDepartStr Format HH:mm (ex: "09:00" ou "18:00")
 * @returns Date valide pour la simulation, ou fallback sur "aujourd'hui 8h" si invalide
 */
export function construireDateDepart(dateCourse: string | undefined | null, heureDepartStr: string | undefined | null): Date {
  if (!dateCourse || !heureDepartStr) {
    const fallback = new Date()
    fallback.setHours(8, 0, 0, 0)
    return fallback
  }
  const dateFinale = new Date(`${dateCourse}T${heureDepartStr}:00`)
  if (Number.isNaN(dateFinale.getTime())) {
    const fallback = new Date()
    fallback.setHours(8, 0, 0, 0)
    return fallback
  }
  return dateFinale
}

/**
 * Retourne un libellé de countdown pour la carte course (ex: "J-45", "Dans 2 mois", "Date non renseignée").
 * @param dateStr Format YYYY-MM-DD (ex: "2024-08-30")
 * @param startTimeStr Optionnel HH:mm pour afficher l'heure (ex: "09:00")
 */
export function formatCountdownLabel(dateStr: string | undefined | null, startTimeStr?: string | undefined | null): string {
  if (!dateStr || !dateStr.trim()) return 'Date non renseignée'
  const courseDate = new Date(dateStr + (startTimeStr ? `T${startTimeStr}:00` : 'T12:00:00'))
  if (Number.isNaN(courseDate.getTime())) return 'Date non renseignée'
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(courseDate)
  target.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return 'Passée'
  if (diffDays === 0) return startTimeStr ? `Aujourd'hui · ${startTimeStr}` : "Aujourd'hui"
  if (diffDays === 1) return startTimeStr ? `Demain · ${startTimeStr}` : 'Demain'
  if (diffDays <= 30) return `J-${diffDays}`
  if (diffDays <= 365) {
    const months = Math.round(diffDays / 30)
    return months <= 1 ? 'Dans 1 mois' : `Dans ${months} mois`
  }
  const years = Math.round(diffDays / 365)
  return years <= 1 ? 'Dans 1 an' : `Dans ${years} ans`
}

/**
 * Retourne un libellé "M-X" pour la page Ma préparation (X = nombre de mois avant la course).
 * @param dateStr Format YYYY-MM-DD (ex: "2024-08-30")
 * @returns "Préparation en cours : M-6", "Course passée", ou "Date non renseignée"
 */
export function formatPreparationMonthsLabel(dateStr: string | undefined | null): string {
  if (!dateStr || !dateStr.trim()) return 'Date non renseignée'
  const courseDate = new Date(dateStr + 'T12:00:00')
  if (Number.isNaN(courseDate.getTime())) return 'Date non renseignée'
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(courseDate)
  target.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return 'Course passée'
  if (diffDays <= 31) {
    const weeks = Math.round(diffDays / 7)
    return weeks <= 1 ? 'Préparation en cours : J-7' : `Préparation en cours : J-${Math.min(diffDays, 99)}`
  }
  const months = Math.round(diffDays / 30)
  return `Préparation en cours : M-${Math.min(months, 24)}`
}
