import { FiThumbsUp, FiThumbsDown } from 'react-icons/fi'
import type { FeedbackContext } from './FeedbackBottomSheet'
import './FeedbackLikeDislike.css'

type FeedbackLikeDislikeProps = {
  onOpenFeedback: (rating: 'like' | 'dislike', context: FeedbackContext) => void
  /** Contexte envoyé à la bottom sheet (détermine titre et tags) */
  context: FeedbackContext
  /** Contexte optionnel pour l'accessibilité */
  label?: string
}

export default function FeedbackLikeDislike({ onOpenFeedback, context, label }: FeedbackLikeDislikeProps) {
  const baseLabel = label ? ` ${label}` : ''
  return (
    <div className="feedback-like-dislike" role="group" aria-label={`Donner votre avis${baseLabel}`}>
      <button
        type="button"
        className="feedback-like-dislike__btn feedback-like-dislike__btn--like"
        onClick={() => onOpenFeedback('like', context)}
        aria-label={`Utile${baseLabel}`}
        title="Utile"
      >
        <FiThumbsUp className="feedback-like-dislike__icon" aria-hidden />
      </button>
      <button
        type="button"
        className="feedback-like-dislike__btn feedback-like-dislike__btn--dislike"
        onClick={() => onOpenFeedback('dislike', context)}
        aria-label={`Pas utile${baseLabel}`}
        title="Pas utile"
      >
        <FiThumbsDown className="feedback-like-dislike__icon" aria-hidden />
      </button>
    </div>
  )
}
