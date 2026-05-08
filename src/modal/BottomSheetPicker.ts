import { t } from '../i18n'

export interface BottomSheetOption {
  key: string
  label: string
}

interface BottomSheetPickerParams {
  containerEl: HTMLElement
  title: string
  options: BottomSheetOption[]
  selected?: string
  searchable?: boolean
  onSelect: (key: string) => void
}

export function filterBottomSheetOptions(
  options: BottomSheetOption[],
  query: string,
): BottomSheetOption[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return options
  return options.filter(option =>
    option.label.toLowerCase().includes(needle) ||
    option.key.toLowerCase().includes(needle)
  )
}

export function openBottomSheetPicker(params: BottomSheetPickerParams): () => void {
  const { containerEl, title, options, selected, searchable = false, onSelect } = params
  let closeTimer: number | null = null
  let currentQuery = ''

  const backdrop = containerEl.createDiv('pw-bottom-sheet-backdrop')
  const sheet = backdrop.createDiv('pw-bottom-sheet')
  document.body.addClass('pw-bottom-sheet-lock')
  containerEl.addClass('pw-bottom-sheet-active')

  const close = () => {
    if (closeTimer !== null) return
    backdrop.addClass('is-closing')
    document.body.removeClass('pw-bottom-sheet-lock')
    containerEl.removeClass('pw-bottom-sheet-active')
    containerEl.removeClass('pw-mobile-text-focus')
    closeTimer = window.setTimeout(() => {
      backdrop.remove()
      closeTimer = null
    }, 200)
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })

  sheet.createDiv('pw-bottom-sheet-handle')
  const bar = sheet.createDiv('pw-bottom-sheet-bar')
  const cancelBtn = bar.createEl('button', {
    cls: 'pw-bottom-sheet-btn',
    text: t('ui.cancel'),
  })
  bar.createEl('span', { cls: 'pw-bottom-sheet-title', text: title })
  bar.createSpan('pw-bottom-sheet-spacer')
  cancelBtn.addEventListener('click', close)

  let searchInput: HTMLInputElement | null = null
  if (searchable) {
    searchInput = sheet.createEl('input', {
      type: 'text',
      cls: 'pw-bottom-sheet-search',
      placeholder: 'Search',
    })
  }

  const listEl = sheet.createDiv('pw-bottom-sheet-options')

  const renderOptions = () => {
    listEl.empty()
    const visibleOptions = filterBottomSheetOptions(options, currentQuery)
    if (visibleOptions.length === 0) {
      listEl.createDiv({ cls: 'pw-bottom-sheet-empty', text: 'No matches' })
      return
    }

    for (const option of visibleOptions) {
      const item = listEl.createEl('button', {
        cls: 'pw-bottom-sheet-option',
        text: option.label,
      })
      item.dataset['value'] = option.key
      item.toggleClass('is-selected', option.key === selected)
      item.addEventListener('click', () => {
        try {
          onSelect(option.key)
        } finally {
          close()
        }
      })
    }
  }

  searchInput?.addEventListener('input', () => {
    currentQuery = searchInput?.value ?? ''
    renderOptions()
  })
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    close()
  })

  renderOptions()
  requestAnimationFrame(() => backdrop.addClass('is-open'))

  return close
}
