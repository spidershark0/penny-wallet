import { t } from '../i18n'
import { validateTag } from '../utils'
import type { WalletFile } from '../io/WalletFile'

export const TAG_LIMIT = 3

const CJK_RE = /[一-鿿㐀-䶿豈-﫿]/

export function filterTagsByQuery(tags: readonly string[], query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...tags]
  return tags.filter(tag => tag.toLowerCase().includes(needle))
}

export function toggleStagedTag(staged: ReadonlySet<string>, tag: string): Set<string> {
  const next = new Set(staged)
  if (next.has(tag)) next.delete(tag)
  else next.add(tag)
  return next
}

export type AddRowState =
  | { kind: 'empty' }                       // search empty — row prompts to focus search
  | { kind: 'invalid'; name: string }       // search has chars but fails validateTag
  | { kind: 'duplicate'; name: string }     // exact match against existing tag
  | { kind: 'limit'; name: string }         // would exceed 3-tag staged cap
  | { kind: 'addable'; name: string }       // ready to add

export function getAddRowState(
  query: string,
  existingTags: readonly string[],
  stagedCount: number,
): AddRowState {
  const normalized = query.trim().replace(/^#/, '').trim()
  if (!normalized) return { kind: 'empty' }
  if (!validateTag(normalized)) return { kind: 'invalid', name: normalized }
  if (existingTags.includes(normalized)) return { kind: 'duplicate', name: normalized }
  if (stagedCount >= TAG_LIMIT) return { kind: 'limit', name: normalized }
  return { kind: 'addable', name: normalized }
}

// ── UI ────────────────────────────────────────────────────────────────────────

interface TagPickerParams {
  containerEl: HTMLElement
  walletFile: WalletFile
  initialSelected: readonly string[]
  onCommit: (selected: string[]) => void
}

export function openTagPicker(params: TagPickerParams): () => void {
  const { containerEl, walletFile, initialSelected, onCommit } = params
  let staged = new Set<string>(initialSelected)
  let query = ''
  let closeTimer: number | null = null

  const backdrop = containerEl.createDiv('pw-bottom-sheet-backdrop')
  const sheet = backdrop.createDiv('pw-bottom-sheet pw-tag-picker')
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

  // Top bar
  sheet.createDiv('pw-bottom-sheet-handle')
  const bar = sheet.createDiv('pw-bottom-sheet-bar')
  const cancelBtn = bar.createEl('button', { cls: 'pw-bottom-sheet-btn', text: t('ui.cancel') })
  bar.createEl('span', { cls: 'pw-bottom-sheet-title', text: t('tagPicker.title') })
  const doneBtn = bar.createEl('button', {
    cls: 'pw-bottom-sheet-btn pw-bottom-sheet-btn--done',
    text: t('modal.done'),
  })
  cancelBtn.addEventListener('click', close)
  doneBtn.addEventListener('click', () => {
    onCommit([...staged])
    close()
  })

  // Search row — sized via shared .pw-bottom-sheet-search
  const searchInput = sheet.createEl('input', {
    type: 'text',
    cls: 'pw-bottom-sheet-search',
    placeholder: t('tagPicker.search'),
  })

  // Inline add button — sits directly below search (always above the
  // keyboard when it rises). Hidden when search is empty.
  const inlineAdd = sheet.createEl('button', { cls: 'pw-tag-picker-inline-add' })
  inlineAdd.hide()

  // Chip area
  const chipArea = sheet.createDiv('pw-tag-picker-chips')

  // Bottom add row — only visible when search is empty (keyboard is down,
  // so it's reachable). Acts as a hint that tapping focuses search.
  const addRow = sheet.createEl('button', {
    cls: 'pw-tag-picker-add-row',
    text: t('tagPicker.addTag'),
  })

  const renderChips = () => {
    chipArea.empty()
    const all = walletFile.getConfig().tags
    const visible = filterTagsByQuery(all, query)

    if (visible.length === 0 && query.trim() !== '') {
      chipArea.createDiv({
        cls: 'pw-tag-picker-empty',
        text: t('tagPicker.noResults').replace('{searchTerm}', query.trim()),
      })
      return
    }

    const atLimit = staged.size >= TAG_LIMIT

    for (const tag of visible) {
      const isSelected = staged.has(tag)
      const isDisabled = !isSelected && atLimit
      const chip = chipArea.createEl('button', { cls: 'pw-tag-picker-chip', text: `#${tag}` })
      chip.toggleClass('is-selected', isSelected)
      chip.toggleClass('is-disabled', isDisabled)

      chip.addEventListener('click', () => {
        if (isDisabled) return
        staged = toggleStagedTag(staged, tag)
        renderChips()
      })
    }
  }

  // Live-filter the search input so it can double as the new-tag candidate:
  // strip , and |, cap length per validateTag rules. Search staying within
  // tag-name rules also prevents the addRow falling into 'invalid' state by
  // user typing — they can still paste invalid content (handled defensively
  // in getAddRowState).
  let lastValidSearch = searchInput.value
  const filterSearch = () => {
    const v = searchInput.value
    const stripped = v.replace(/[,|]/g, '')
    const noHash = stripped.replace(/^#/, '')
    const hasCjk = CJK_RE.test(noHash)
    const maxLen = hasCjk ? 5 : 10
    if ([...noHash].length > maxLen) {
      searchInput.value = lastValidSearch
      return
    }
    if (stripped !== v) searchInput.value = stripped
    lastValidSearch = searchInput.value
  }

  const renderAddUI = () => {
    const state = getAddRowState(query, walletFile.getConfig().tags, staged.size)

    // Bottom row only when search is empty (keyboard down → reachable).
    if (state.kind === 'empty') {
      addRow.show()
      inlineAdd.hide()
      return
    }
    addRow.hide()

    // Inline (above-fold) row reflects state when search has content.
    inlineAdd.removeAttribute('disabled')
    inlineAdd.removeClass('is-disabled')
    switch (state.kind) {
      case 'addable':
        inlineAdd.show()
        inlineAdd.setText(t('tagPicker.addNamed').replace('{name}', state.name))
        break
      case 'duplicate':
        // Existing chip will appear in chip area for the user to tap; no
        // need for a separate add affordance.
        inlineAdd.hide()
        break
      case 'limit':
        inlineAdd.show()
        inlineAdd.setText(t('tagPicker.tagLimit'))
        inlineAdd.setAttribute('disabled', 'true')
        inlineAdd.addClass('is-disabled')
        break
      case 'invalid':
        // Defensive against paste; typed input is filtered by filterSearch.
        inlineAdd.show()
        inlineAdd.setText(t('tagPicker.addNamed').replace('{name}', state.name))
        inlineAdd.setAttribute('disabled', 'true')
        inlineAdd.addClass('is-disabled')
        break
    }
  }

  const submitNewTag = async () => {
    const state = getAddRowState(query, walletFile.getConfig().tags, staged.size)
    if (state.kind !== 'addable') return
    const result = await walletFile.addTag(state.name)
    if (!result.ok) return // race: another path added it; silent
    staged.add(state.name)
    searchInput.value = ''
    query = ''
    lastValidSearch = ''
    renderChips()
    renderAddUI()
  }

  searchInput.addEventListener('input', () => {
    filterSearch()
    query = searchInput.value
    renderChips()
    renderAddUI()
  })
  searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    close()
  })

  // Bottom row is only visible when search is empty; tapping it focuses
  // search to invite typing (the actual add happens via inline button).
  addRow.addEventListener('click', () => {
    searchInput.focus()
  })

  inlineAdd.addEventListener('click', submitNewTag)

  renderChips()
  renderAddUI()
  requestAnimationFrame(() => backdrop.addClass('is-open'))

  return close
}
