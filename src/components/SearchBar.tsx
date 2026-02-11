import { useState } from 'react'
import { FiSearch } from 'react-icons/fi'
import { HiX } from 'react-icons/hi'

import './SearchBar.css'

export type SearchBarProps = {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onClear?: () => void
  onFocus?: () => void
  onBlur?: () => void
  className?: string
  'aria-label'?: string
}

export default function SearchBar({
  placeholder = 'Rechercher un parcours…',
  value: controlledValue,
  onChange,
  onClear,
  onFocus,
  onBlur,
  className = '',
  'aria-label': ariaLabel = 'Recherche',
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState('')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (!isControlled) setInternalValue(v)
    onChange?.(v)
  }

  const handleClear = () => {
    if (!isControlled) setInternalValue('')
    onChange?.('')
    onClear?.()
  }

  return (
    <div className={`search-bar ${className}`.trim()} role="search">
      <div className="search-bar__row">
        <FiSearch className="search-bar__icon" aria-hidden />
        <div className={`search-bar__input-wrap${value.length > 0 ? ' search-bar__input-wrap--has-clear' : ''}`}>
          <input
            type="search"
            value={value}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            className="search-bar__input"
            aria-label={ariaLabel}
            autoComplete="off"
          />
          {value.length > 0 && (
            <button
              type="button"
              className="search-bar__clear"
              onClick={handleClear}
              aria-label="Effacer la recherche"
            >
              <HiX />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
