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

export interface BottomSheetShellParams {
  containerEl: HTMLElement
  title: string
  leftBtn?: { label: string; onClick: (close: () => void) => void } | null
  rightBtn?: { label: string; onClick: (close: () => void) => void } | null
  onClose?: () => void
  leafContext?: boolean
}

export interface BottomSheetShell {
  sheet: HTMLElement
  titleEl: HTMLElement
  close: () => void
}

export function openBottomSheetShell(params: BottomSheetShellParams): BottomSheetShell {
  const { containerEl, title, leftBtn, rightBtn, onClose, leafContext } = params
  let closeTimer: number | null = null

  const backdrop = containerEl.createDiv('pw-bottom-sheet-backdrop')
  if (leafContext) {
    backdrop.addClass('is-leaf-context')
    const toolbar = document.querySelector<HTMLElement>(
      '.workspace-mobile-toolbar, .mobile-toolbar, .mod-mobile-toolbar'
    )
    if (toolbar && toolbar.offsetHeight > 0) {
      backdrop.style.paddingBottom = `${toolbar.offsetHeight + 8}px`
    }
  }
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
      onClose?.()
      closeTimer = null
    }, 200)
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })

  sheet.createDiv('pw-bottom-sheet-handle')
  const bar = sheet.createDiv('pw-bottom-sheet-bar')

  if (leftBtn) {
    const btn = bar.createEl('button', { cls: 'pw-bottom-sheet-btn', text: leftBtn.label })
    btn.addEventListener('click', () => leftBtn.onClick(close))
  } else {
    bar.createSpan('pw-bottom-sheet-spacer')
  }

  const titleEl = bar.createEl('span', { cls: 'pw-bottom-sheet-title', text: title })

  if (rightBtn) {
    const btn = bar.createEl('button', { cls: 'pw-bottom-sheet-btn pw-bottom-sheet-btn-primary', text: rightBtn.label })
    btn.addEventListener('click', () => rightBtn.onClick(close))
  } else {
    bar.createSpan('pw-bottom-sheet-spacer')
  }

  requestAnimationFrame(() => backdrop.addClass('is-open'))

  return { sheet, titleEl, close }
}

export function openBottomSheetPicker(params: BottomSheetPickerParams): () => void {
  const { containerEl, title, options, selected, searchable = false, onSelect } = params
  let currentQuery = ''

  const { sheet, close } = openBottomSheetShell({
    containerEl,
    title,
    leftBtn: { label: t('ui.cancel'), onClick: (c) => c() },
  })

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

  return close
}

interface FilterSheetParams {
  containerEl: HTMLElement
  title: string
  buildBody: (sheet: HTMLElement) => void
  buildFooter?: (footer: HTMLElement) => void
  onCancel: () => void
  onDone: () => void
  onClose?: () => void
}

export function openFilterSheet(params: FilterSheetParams): () => void {
  const { sheet, close } = openBottomSheetShell({
    containerEl: params.containerEl,
    title: params.title,
    leftBtn: { label: t('ui.cancel'), onClick: (c) => { params.onCancel(); c() } },
    rightBtn: { label: t('detail.filterDone'), onClick: (c) => { params.onDone(); c() } },
    onClose: params.onClose,
    leafContext: true,
  })
  sheet.addClass('pw-filter-sheet')

  const body = sheet.createDiv('pw-filter-sheet-body')
  params.buildBody(body)

  if (params.buildFooter) {
    const footer = sheet.createDiv('pw-filter-sheet-footer')
    params.buildFooter(footer)
  }

  return close
}
