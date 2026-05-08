import { setIcon } from 'obsidian'
import { TransactionType, PennyWalletConfig } from '../types'
import { t } from '../i18n'
import { TransactionModal } from './TransactionModal'
import { formatMobileHeroAmount } from '../utils'
import { getTransferWalletCandidates } from './transactionState'
import { openBottomSheetPicker, type BottomSheetOption } from './BottomSheetPicker'
import { openTagPicker } from './TagPicker'

export class MobileTransactionModal extends TransactionModal {
  private mobileTabsEl!: HTMLElement
  private mobileRowsEl!: HTMLElement
  private mobileAmountEl!: HTMLElement
  private viewportCleanups: (() => void)[] = []

  onOpen() {
    const config = this.walletFile.getConfig()
    this.initState(config)
    this.buildMobileUI(config)
    // iOS auto-focuses first button; delay ensures blur after animation
    setTimeout(() => (document.activeElement as HTMLElement)?.blur(), 100)
  }

  private buildMobileUI(config: PennyWalletConfig) {
    const { contentEl, containerEl } = this
    contentEl.empty()
    contentEl.addClass('pw-mobile-content')
    containerEl.addClass('pw-transaction-modal-container')

    // Top bar: ✕ | title | ✓
    const topBar = contentEl.createDiv('pw-mobile-top-bar')
    const cancelBtn = topBar.createEl('button', { cls: 'pw-mobile-top-btn', text: '✕' })
    topBar.createEl('span', {
      cls: 'pw-mobile-top-title',
      text: this.editingTx ? t('modal.editTitle') : t('modal.addTitle'),
    })
    const confirmBtn = topBar.createEl('button', {
      cls: 'pw-mobile-top-btn pw-mobile-top-confirm',
      text: '✓',
    })
    let cancelTouched = false
    cancelBtn.addEventListener('touchend', (e) => { e.preventDefault(); cancelTouched = true; this.close() })
    cancelBtn.addEventListener('click', () => { if (cancelTouched) { cancelTouched = false; return } this.close() })
    let confirmTouched = false
    confirmBtn.addEventListener('touchend', (e) => { e.preventDefault(); confirmTouched = true; void this.handleConfirm() })
    confirmBtn.addEventListener('click', () => { if (confirmTouched) { confirmTouched = false; return } void this.handleConfirm() })

    if (this.editingTx) {
      const titleEl = topBar.querySelector<HTMLElement>('.pw-mobile-top-title')
      if (titleEl) {
        const iconEl = titleEl.createSpan('pw-modal-title-icon')
        setIcon(iconEl, 'pencil')
      }
    }

    // Type tabs
    this.mobileTabsEl = contentEl.createDiv('pw-mobile-tabs')
    this.renderMobileTabs(config)

    // Amount display
    const amountArea = contentEl.createDiv('pw-mobile-amount-area')
    this.mobileAmountEl = amountArea.createDiv('pw-mobile-amount-display')
    this.updateAmountDisplay()

    // Error
    this.errorEl = contentEl.createDiv('pw-error pw-mobile-error')
    this.errorEl.hide()

    // Field rows
    this.mobileRowsEl = contentEl.createDiv('pw-mobile-rows')
    this.renderMobileRows(config)

    // Numpad
    const numpadEl = contentEl.createDiv('pw-mobile-numpad')
    this.renderMobileNumpad(numpadEl)

    this.bindMobileTextFocusState()
  }

  private bindMobileTextFocusState() {
    const isTextKeyboardTarget = (target: EventTarget | null): target is HTMLElement => {
      return target instanceof HTMLElement &&
        target.matches('.pw-mobile-note-input, .pw-bottom-sheet-search, .pw-tag-picker-add-input')
    }

    this.contentEl.addEventListener('focusin', (e) => {
      if (isTextKeyboardTarget(e.target)) {
        this.contentEl.addClass('pw-mobile-text-focus')
      }
    })

    this.contentEl.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!isTextKeyboardTarget(document.activeElement)) {
          this.contentEl.removeClass('pw-mobile-text-focus')
        }
      }, 0)
    })
  }

  private renderMobileTabs(config: PennyWalletConfig) {
    this.mobileTabsEl.empty()
    const types: TransactionType[] = ['expense', 'income', 'transfer']
    for (const tp of types) {
      const tab = this.mobileTabsEl.createEl('button', {
        text: t(`type.${tp}`),
        cls: 'pw-mobile-tab' + (this.type === tp ? ' is-active' : ''),
      })
      tab.addEventListener('click', () => {
        this.resetStateForType(tp)
        this.renderMobileTabs(config)
        this.renderMobileRows(config)
      })
    }
  }

  private renderMobileRows(config: PennyWalletConfig) {
    this.mobileRowsEl.empty()
    const activeWallets = this.getActiveWallets(config)

    // Refund toggle first (expense only) — sub-option of the type tab, visually adjacent.
    if (this.type === 'expense') {
      const block = this.mobileRowsEl.createDiv('pw-refund-block')
      const refundRow = block.createDiv('pw-mobile-row pw-mobile-refund-row')
      const checkboxId = 'pw-mobile-refund-checkbox'
      refundRow.createEl('label', { cls: 'pw-mobile-row-label', text: t('modal.isRefund'), attr: { for: checkboxId } })
      const checkbox = refundRow.createEl('input', { type: 'checkbox' })
      checkbox.id = checkboxId
      checkbox.checked = this.isRefund
      checkbox.addEventListener('change', () => {
        this.isRefund = checkbox.checked
        this.updateAmountDisplay()
      })
      block.createDiv({ cls: 'pw-mobile-refund-hint-row', text: t('modal.isRefund.hint') })
    }

    // Date Picker
    let dateInput!: HTMLInputElement
    this.addMobilePickerRow(
      this.mobileRowsEl, t('modal.date'), this.formatMobileDate(),
      (valueEl) => {
        dateInput = createEl('input', { type: 'date' })
        dateInput.value = this.date
        dateInput.addClass('pw-hidden-date-trigger')
        dateInput.addEventListener('change', () => {
          this.date = dateInput.value
          valueEl.textContent = this.formatMobileDate()
        })
        return dateInput
      },
      () => dateInput.focus(),
    ).addClass('pw-mobile-date-row')

    const categories = this.getCategoryOptions(config)
    const catLabel = categories.find(c => c.key === this.category)?.label ?? (this.category || '—')
    const isTransferOrPayment = this.type !== 'expense' && this.type !== 'income'
    const onCategoryChange = isTransferOrPayment
      ? (key: string) => { this.category = key; this.renderMobileRows(config) }
      : (key: string) => { this.category = key }

    this.addMobileBottomSheetRow(
      this.mobileRowsEl,
      t('modal.category'),
      catLabel,
      this.withEmptyOption(categories),
      () => this.category,
      onCategoryChange,
      true,
    )

    if (isTransferOrPayment) {
      this.normalizeWalletForCategory(config)

      const { fromCandidates: fromWallets, toCandidates: toWallets }
        = getTransferWalletCandidates(activeWallets, this.category)

      this.addMobileBottomSheetRow(
        this.mobileRowsEl,
        t('modal.fromWallet'),
        this.fromWallet || '—',
        this.withEmptyOption(fromWallets.map(w => ({ key: w.name, label: w.name }))),
        () => this.fromWallet,
        (key) => { this.fromWallet = key },
        true,
      )

      this.addMobileBottomSheetRow(
        this.mobileRowsEl,
        t('modal.toWallet'),
        this.toWallet || '—',
        this.withEmptyOption(toWallets.map(w => ({ key: w.name, label: w.name }))),
        () => this.toWallet,
        (key) => { this.toWallet = key },
        true,
      )
    } else {
      const walletOptions = this.type === 'income'
        ? activeWallets.filter(w => w.type !== 'creditCard')
        : activeWallets

      this.addMobileBottomSheetRow(
        this.mobileRowsEl,
        t('modal.wallet'),
        this.wallet || '—',
        this.withEmptyOption(walletOptions.map(w => ({ key: w.name, label: w.name }))),
        () => this.wallet,
        (key) => { this.wallet = key },
        true,
      )
    }

    // Tags — chips-or-placeholder row, taps anywhere to open multi-select picker
    const tagRow = this.mobileRowsEl.createDiv('pw-mobile-row')
    tagRow.dataset['testid'] = 'mobile-tag-row'
    tagRow.createEl('span', { cls: 'pw-mobile-row-label', text: t('modal.tags') })
    const tagWrapper = tagRow.createDiv('pw-tag-input-wrapper')
    const tagChipsEl = tagWrapper.createDiv('pw-mobile-tag-chips')
    tagChipsEl.dataset['testid'] = 'mobile-tag-chips'

    const renderMobChips = () => {
      tagChipsEl.empty()
      if (this.tags.length === 0) {
        tagChipsEl.createSpan({
          cls: 'pw-mobile-tag-row-placeholder',
          text: t('tagPicker.rowPlaceholder'),
        })
        return
      }
      for (const tag of this.tags) {
        // Display-only chips that match the picker's selected style (oval, accent).
        // Tap anywhere on the row (chip or whitespace) opens the picker (B1).
        const chip = tagChipsEl.createSpan({
          cls: 'pw-tag-picker-chip is-selected',
          text: `#${tag}`,
        })
        chip.dataset['testid'] = 'mobile-tag-chip'
        chip.dataset['tag'] = tag
      }
    }

    tagChipsEl.addEventListener('click', () => {
      openTagPicker({
        containerEl: this.contentEl,
        walletFile: this.walletFile,
        initialSelected: this.tags,
        onCommit: (selected) => {
          this.tags = selected
          renderMobChips()
        },
      })
    })

    renderMobChips()

    // Note
    const noteRow = this.mobileRowsEl.createDiv('pw-mobile-row')
    noteRow.createEl('span', { cls: 'pw-mobile-row-label', text: t('modal.note') })
    const noteInput = noteRow.createEl('input', {
      type: 'text',
      cls: 'pw-mobile-note-input',
      placeholder: t('modal.note'),
    })
    noteInput.value = this.note
    noteInput.setAttribute('enterkeyhint', 'done')
    noteInput.addEventListener('input', () => { this.note = noteInput.value })
    noteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') noteInput.blur() })
  }

  private addMobilePickerRow(
    container: HTMLElement,
    label: string,
    initialValue: string,
    buildPicker: (valueEl: HTMLElement) => HTMLElement,
    onRowClick?: () => void,
  ): HTMLElement {
    const row = container.createDiv('pw-mobile-row')
    row.createEl('span', { cls: 'pw-mobile-row-label', text: label })
    const valueEl = row.createEl('span', { cls: 'pw-mobile-row-value', text: initialValue })
    const picker = buildPicker(valueEl)
    row.appendChild(picker)
    if (onRowClick) row.addEventListener('click', onRowClick)
    return row
  }

  private addMobileBottomSheetRow(
    container: HTMLElement,
    label: string,
    initialValue: string,
    options: BottomSheetOption[],
    getSelected: () => string,
    onSelect: (key: string) => void,
    required = false,
  ) {
    const row = container.createDiv('pw-mobile-row pw-mobile-bottom-sheet-row')
    row.setAttribute('role', 'button')
    row.tabIndex = 0
    const labelEl = row.createEl('span', { cls: 'pw-mobile-row-label', text: label })
    if (required) labelEl.createEl('span', { text: '*', cls: 'pw-field-required', attr: { 'aria-hidden': 'true' } })
    const valueEl = row.createEl('span', { cls: 'pw-mobile-row-value', text: initialValue })

    const openPicker = () => {
      openBottomSheetPicker({
        containerEl: this.contentEl,
        title: label,
        options,
        selected: getSelected(),
        searchable: true,
        onSelect: (key) => {
          onSelect(key)
          const found = options.find(option => option.key === key)
          valueEl.textContent = found?.label ?? (key || '—')
        },
      })
    }

    row.addEventListener('click', openPicker)
    row.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      openPicker()
    })
  }

  private withEmptyOption(options: BottomSheetOption[]): BottomSheetOption[] {
    return [{ key: '', label: '—' }, ...options]
  }

  private renderMobileNumpad(el: HTMLElement) {
    // Layout (4 cols):
    //  7   8   9   ⌫
    //  4   5   6   C
    //  1   2   3   ✓  ← ✓ spans rows 3–4
    //  .   0   00
    const topKeys = ['7', '8', '9', '⌫', '4', '5', '6', 'C', '1', '2', '3']
    const bottomKeys = ['.', '0', '00']

    for (const key of topKeys) {
      const btn = el.createEl('button', { cls: 'pw-mobile-numpad-btn', text: key })
      if (key === '⌫' || key === 'C') btn.addClass('pw-mobile-numpad-control')
      this.bindNumpadButton(btn, key)
    }

    // ✓ spans rows 3–4 at col 4 (handled via CSS class)
    const confirmBtn = el.createEl('button', {
      cls: 'pw-mobile-numpad-btn pw-mobile-numpad-confirm',
      text: '✓',
    })
    this.bindNumpadButton(confirmBtn, '✓')

    for (const key of bottomKeys) {
      const btn = el.createEl('button', { cls: 'pw-mobile-numpad-btn', text: key })
      this.bindNumpadButton(btn, key)
    }
  }

  private bindNumpadButton(btn: HTMLButtonElement, key: string) {
    let touched = false
    let clearPressedTimer: number | null = null
    const clearFocus = () => requestAnimationFrame(() => btn.blur())
    const setPressed = () => {
      if (clearPressedTimer !== null) {
        window.clearTimeout(clearPressedTimer)
        clearPressedTimer = null
      }
      btn.classList.add('is-pressed')
    }
    const clearPressed = () => {
      btn.classList.remove('is-pressed')
      clearFocus()
    }
    const scheduleClearPressed = () => {
      if (clearPressedTimer !== null) window.clearTimeout(clearPressedTimer)
      clearPressedTimer = window.setTimeout(() => {
        clearPressedTimer = null
        clearPressed()
      }, 90)
    }

    btn.addEventListener('touchstart', setPressed, { passive: true })
    btn.addEventListener('pointerdown', setPressed)
    btn.addEventListener('pointerup', scheduleClearPressed)
    btn.addEventListener('pointercancel', clearPressed)
    btn.addEventListener('pointerleave', clearPressed)
    btn.addEventListener('touchcancel', clearPressed)
    btn.addEventListener('touchend', (e) => {
      e.preventDefault()
      touched = true
      this.handleNumpadKey(key)
      scheduleClearPressed()
    })
    btn.addEventListener('click', () => {
      if (touched) {
        touched = false
        return
      }
      this.handleNumpadKey(key)
      scheduleClearPressed()
    })
  }

  private handleNumpadKey(key: string) {
    this.clearError()
    if (key === '✓') { void this.handleConfirm(); return }
    if (key === 'C') { this.amount = ''; this.updateAmountDisplay(); return }
    if (key === '⌫') { this.amount = this.amount.slice(0, -1); this.updateAmountDisplay(); return }
    if (key === '.') {
      if (this.amount.includes('.')) return
      if (this.amount === '') this.amount = '0'
      this.amount += '.'
      this.updateAmountDisplay()
      return
    }
    if (key === '00') {
      if (this.amount === '' || this.amount === '0') return
      this.amount += '00'
      this.updateAmountDisplay()
      return
    }
    this.amount = this.amount === '0' ? key : this.amount + key
    this.updateAmountDisplay()
  }

  private updateAmountDisplay() {
    if (!this.mobileAmountEl) return
    const isEmpty = this.amount === ''
    this.mobileAmountEl.textContent = formatMobileHeroAmount(this.amount, this.isRefund)
    this.mobileAmountEl.toggleClass('is-empty', isEmpty)
  }

  private formatMobileDate(): string {
    return this.date.replace(/-/g, '/')
  }

  onClose() {
    this.viewportCleanups.forEach(fn => fn())
    this.viewportCleanups = []
    document.body.removeClass('pw-bottom-sheet-lock')
    this.containerEl.removeClass('pw-transaction-modal-container')
    this.contentEl.removeClass('pw-bottom-sheet-active')
    this.contentEl.removeClass('pw-mobile-text-focus')
    super.onClose()
  }
}
