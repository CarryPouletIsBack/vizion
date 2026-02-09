import { useState, useEffect, useCallback } from 'react'
import {
  addCourseToMyParcours,
  removeCourseFromMyParcours,
  isCourseInMyParcours,
} from '../lib/userCourseSelections'

export function useMyParcoursButton(courseId: string | undefined, createdByUserId?: string | null) {
  const [isInMyParcours, setIsInMyParcours] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!courseId) {
      setChecking(false)
      return
    }
    let cancelled = false
    setChecking(true)
    isCourseInMyParcours(courseId, createdByUserId).then((result) => {
      if (!cancelled) {
        setIsInMyParcours(result)
        setChecking(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [courseId, createdByUserId])

  const addToMyParcours = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    const { success, error } = await addCourseToMyParcours(courseId)
    setLoading(false)
    if (success) {
      setIsInMyParcours(true)
      window.dispatchEvent(new CustomEvent('my-parcours-changed'))
    } else if (error) alert(error)
  }, [courseId])

  const removeFromMyParcours = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    const { success, error } = await removeCourseFromMyParcours(courseId)
    setLoading(false)
    if (success) {
      setIsInMyParcours(false)
      window.dispatchEvent(new CustomEvent('my-parcours-changed'))
    } else if (error) alert(error)
  }, [courseId])

  return { isInMyParcours, loading, checking, addToMyParcours, removeFromMyParcours }
}
