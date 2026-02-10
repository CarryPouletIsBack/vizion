import { useState, useEffect } from 'react'
import { HiX } from 'react-icons/hi'
import './FeedbackBottomSheet.css'

/** Contexte d’ouverture du feedback (détermine titre et tags) */
export type FeedbackContext =
  | 'parcours'
  | 'description'
  | 'bon-temps'
  | 'conseil-passage'
  | 'verdict-coach'
  | 'prochaine-echeance'
  | 'objectifs'
  | 'charge-regularite'
  | 'ajustements'
  | 'projection'

/** Tags par contexte */
export const FEEDBACK_TAGS_BY_CONTEXT: Record<FeedbackContext, readonly string[]> = {
  parcours: [
    'Météo imprécise',
    'Temps sous-estimé',
    'Profil difficile',
    'Météo imprévue',
    'Balisage confus',
    'Ravitaillement',
    'Autre',
  ],
  description: [
    'Infos incomplètes',
    'Météo imprécise',
    'Carte utile',
    'Données incorrectes',
    'Autre',
  ],
  'bon-temps': [
    'Fourchette pas réaliste',
    'Estimation utile',
    'Comparaison utile',
    'Texte pas clair',
    'Autre',
  ],
  'conseil-passage': [
    'Conseil pas clair',
    'Conseil pas adapté au secteur',
    'Trop long à lire',
    'Utile',
    'Autre',
  ],
  'verdict-coach': [
    'Verdict trop sévère',
    'Verdict pas réaliste',
    'Verdict utile',
    'Manque de détails',
    'Autre',
  ],
  'prochaine-echeance': [
    'Objectifs trop ambitieux',
    'Objectifs pas clairs',
    'Objectifs adaptés',
    'Autre',
  ],
  objectifs: [
    'Objectifs trop ambitieux',
    'Objectifs pas clairs',
    'Objectifs adaptés',
    'Autre',
  ],
  'charge-regularite': [
    'Données incorrectes',
    'Temps estimé pas réaliste',
    'Graphique utile',
    'Autre',
  ],
  ajustements: [
    'Actions pas pertinentes',
    'Actions utiles',
    'Trop nombreuses',
    'Autre',
  ],
  projection: [
    'Projection pas réaliste',
    'Projection utile',
    'Texte pas clair',
    'Autre',
  ],
}

/** Tags par défaut (parcours) — rétrocompatibilité */
export const FEEDBACK_TAGS = FEEDBACK_TAGS_BY_CONTEXT.parcours

export type FeedbackPayload = {
  userId?: string | null
  courseId?: string | null
  courseName?: string | null
  activityId?: string | null
  rating: 'like' | 'dislike'
  tags: string[]
  comment?: string | null
}

type FeedbackBottomSheetProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  courseId?: string | null
  courseName?: string | null
  userId?: string | null
  activityId?: string | null
  /** Pré-sélection du like/dislike quand on ouvre depuis une icône */
  initialRating?: 'like' | 'dislike' | null
  /** Contexte d’ouverture (parcours, conseil de passage, verdict, etc.) — détermine titre et tags */
  context?: FeedbackContext | null
}

export default function FeedbackBottomSheet({
  isOpen,
  onClose,
  onSuccess,
  courseId,
  courseName,
  userId,
  activityId,
  initialRating: initialRatingProp = null,
  context: contextProp = 'parcours',
}: FeedbackBottomSheetProps) {
  const [rating, setRating] = useState<'like' | 'dislike' | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveContext: FeedbackContext = contextProp ?? 'parcours'
  const tagsForContext = FEEDBACK_TAGS_BY_CONTEXT[effectiveContext] ?? FEEDBACK_TAGS_BY_CONTEXT.parcours

  const contextTitles: Record<FeedbackContext, { title: string; subtitle: string }> = {
    parcours: { title: 'Votre avis sur ce parcours', subtitle: 'Kaldera s\'améliore grâce à vos retours.' },
    description: { title: 'Votre avis sur la description du parcours', subtitle: 'Vos retours nous aident à améliorer les infos affichées.' },
    'bon-temps': { title: 'Votre avis sur les temps de référence', subtitle: 'Vos retours aident à affiner les fourchettes et comparaisons.' },
    'conseil-passage': { title: 'Votre avis sur ce conseil de passage', subtitle: 'Ces retours nous aident à améliorer les conseils par secteur.' },
    'verdict-coach': { title: 'Votre avis sur le verdict du coach', subtitle: 'Vos retours permettent d\'ajuster les analyses.' },
    'prochaine-echeance': { title: 'Votre avis sur la prochaine échéance', subtitle: 'Vos retours nous aident à affiner les objectifs.' },
    objectifs: { title: 'Votre avis sur les objectifs', subtitle: 'Vos retours nous aident à proposer des objectifs plus pertinents.' },
    'charge-regularite': { title: 'Votre avis sur la charge et la régularité', subtitle: 'Vos retours améliorent l\'affichage et les estimations.' },
    ajustements: { title: 'Votre avis sur les ajustements recommandés', subtitle: 'Vos retours nous aident à mieux cibler les actions.' },
    projection: { title: 'Votre avis sur la projection', subtitle: 'Vos retours améliorent les textes générés.' },
  }
  const { title: sheetTitle, subtitle: sheetSubtitle } = contextTitles[effectiveContext]

  useEffect(() => {
    if (isOpen) {
      setRating(initialRatingProp ?? null)
    } else {
      setRating(null)
      setSelectedTags([])
      setComment('')
      setError(null)
    }
  }, [isOpen, initialRatingProp])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === null) {
      setError('Choisissez 👍 ou 👎')
      return
    }
    setError(null)
    setIsSubmitting(true)
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    try {
      const res = await fetch(`${base}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId ?? null,
          courseId: courseId ?? null,
          courseName: courseName ?? null,
          activityId: activityId ?? null,
          rating,
          tags: selectedTags,
          comment: comment.trim() || null,
        } as FeedbackPayload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || data.error || 'Erreur lors de l’envoi')
        return
      }
      setRating(null)
      setSelectedTags([])
      setComment('')
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="feedback-bottom-sheet-overlay"
      role="dialog"
      aria-labelledby="feedback-sheet-title"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="feedback-bottom-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feedback-bottom-sheet__handle" aria-hidden />
        <div className="feedback-bottom-sheet__inner">
          <div className="feedback-bottom-sheet__header">
            <h2 id="feedback-sheet-title" className="feedback-bottom-sheet__title">
              {sheetTitle}
            </h2>
            <p className="feedback-bottom-sheet__subtitle">
              {sheetSubtitle}
            </p>
            <button
              type="button"
              className="feedback-bottom-sheet__close"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label="Fermer"
            >
              <HiX className="feedback-bottom-sheet__close-icon" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="feedback-bottom-sheet__form">
            <div className="feedback-bottom-sheet__field">
              <span className="feedback-bottom-sheet__label">Vous avez trouvé cela utile ?</span>
              <div className="feedback-bottom-sheet__rating">
                <button
                  type="button"
                  className={`feedback-bottom-sheet__rating-btn ${rating === 'like' ? 'feedback-bottom-sheet__rating-btn--active' : ''}`}
                  onClick={() => setRating('like')}
                  aria-pressed={rating === 'like'}
                >
                  👍 Oui
                </button>
                <button
                  type="button"
                  className={`feedback-bottom-sheet__rating-btn ${rating === 'dislike' ? 'feedback-bottom-sheet__rating-btn--active' : ''}`}
                  onClick={() => setRating('dislike')}
                  aria-pressed={rating === 'dislike'}
                >
                  👎 Non
                </button>
              </div>
            </div>

            <div className="feedback-bottom-sheet__field">
              <span className="feedback-bottom-sheet__label">Tags (optionnel)</span>
              <div className="feedback-bottom-sheet__tags">
                {tagsForContext.map((tag) => (
                  <label
                    key={tag}
                    className={`feedback-bottom-sheet__tag ${selectedTags.includes(tag) ? 'feedback-bottom-sheet__tag--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                      className="feedback-bottom-sheet__tag-input"
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="feedback-bottom-sheet__field">
              <label htmlFor="feedback-comment" className="feedback-bottom-sheet__label">
                Commentaire (optionnel)
              </label>
              <textarea
                id="feedback-comment"
                className="feedback-bottom-sheet__textarea modal-input"
                placeholder="Ex : J’ai mis 2h de plus que prévu, le terrain était impraticable."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>

            {error && (
              <p className="feedback-bottom-sheet__error" role="alert">
                {error}
              </p>
            )}

            <div className="feedback-bottom-sheet__actions">
              <button
                type="button"
                className="feedback-bottom-sheet__cancel"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="modal-primary feedback-bottom-sheet__submit"
                disabled={isSubmitting || rating === null}
              >
                {isSubmitting ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
