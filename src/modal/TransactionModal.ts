import { App, Modal, Notice } from 'obsidian'
import { Transaction, TransactionType, TransactionModalParams, PennyWalletConfig } from '../types'
import { WalletFile, dateToYearMonth } from '../io/WalletFile'
import { t } from '../i18n'
import { parseAmountForEdit, getCategoryOptions as getCategoryOptionsFromState, addTagToList, validateTransactionForm, buildTransactionPayload, getTransferWalletCandidates, type TransactionFormState } from './transactionState'

export class TransactionModal extends Modal {
  protected walletFile: WalletFile
  private params: TransactionModalParams
  protected editingTx: Transaction | null
  private editingYearMonth: string | null
  private onSuccess: (() => void) | null
  private onDismiss: (() => void) | null

  // Form state
  protected type: TransactionType = 'expense'
  protected date: string = ''       // yyyy-mm-dd
  protected wallet: string = ''
  protected fromWallet: string = ''
  protected toWallet: string = ''
  protected category: string = ''
  protected note: string = ''
  protected tags: string[] = []
  protected amount: string = ''
  protected isRefund: boolean = false

  // DOM refs
  private typeTabsEl!: HTMLElement
  private fieldsEl!: HTMLElement
  protected errorEl!: HTMLElement
  private amountPrefixEl: HTMLElement | null = null

  constructor(
    app: App,
    walletFile: WalletFile,
    params: TransactionModalParams = {},
    editingTx: Transaction | null = null,
    editingYearMonth: string | null = null,
    onSuccess: (() => void) | null = null,
    onDismiss: (() => void) | null = null,
  ) {
    super(app)
    this.walletFile = walletFile
    this.params = params
    this.editingTx = editingTx
    this.editingYearMonth = editingYearMonth
    this.onSuccess = onSuccess
    this.onDismiss = onDismiss
  }

  onOpen() {
    const config = this.walletFile.getConfig()
    this.initState(config)
    this.buildUI(config)
  }

  protected initState(config: PennyWalletConfig) {
    if (this.editingTx) {
      const tx = this.editingTx
      this.type = tx.type
      // editingYearMonth is "yyyy-mm", tx.date is "MM/DD" e.g. "04/03"
      const ym = this.editingYearMonth ?? ''
      const day = tx.date.split('/')[1]
      this.date = ym && day ? `${ym}-${day}` : todayString()
      this.wallet = tx.wallet ?? ''
      this.fromWallet = tx.fromWallet ?? ''
      this.toWallet = tx.toWallet ?? ''
      this.category = tx.category ?? ''
      this.note = tx.note
      this.tags = tx.tags ? [...tx.tags] : []
      const parsed = parseAmountForEdit(tx.amount)
      this.amount = parsed.display
      this.isRefund = parsed.isRefund
    } else {
      this.type = (this.params.type as TransactionType) ?? 'expense'
      this.date = this.params.date ?? todayString()
      const activeWallets = this.getActiveWallets(config)
      const defaultWallet = activeWallets.find(w => w.name === config.defaultWallet)
        ?? activeWallets[0]
      this.wallet = this.params.wallet ?? defaultWallet?.name ?? ''
      this.fromWallet = this.params.fromWallet ?? ''
      this.toWallet = this.params.toWallet ?? ''
      this.category = this.params.category ?? ''
      this.note = this.params.note ?? ''
      this.tags = this.params.tags ? [...this.params.tags] : []
      this.amount = this.params.amount != null ? String(this.params.amount) : ''
    }
  }

  private buildUI(config: PennyWalletConfig) {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('pw-modal')

    contentEl.createEl('h2', {
      text: this.editingTx ? t('modal.editTitle') : t('modal.addTitle'),
    })

    this.typeTabsEl = contentEl.createDiv('pw-type-tabs')
    this.renderTypeTabs()

    this.fieldsEl = contentEl.createDiv('pw-fields')
    this.renderFields(config)

    this.errorEl = contentEl.createDiv('pw-error')
    this.errorEl.hide()

    const btnRow = contentEl.createDiv('pw-btn-row')
    const confirmBtn = btnRow.createEl('button', { text: t('ui.confirm'), cls: 'mod-cta' })
    confirmBtn.dataset['action'] = 'confirm'
    const cancelBtn = btnRow.createEl('button', { text: t('ui.cancel') })
    cancelBtn.dataset['action'] = 'cancel'

    // touchend fires before blur (keyboard dismissal), preventing the double-tap issue on iOS
    confirmBtn.addEventListener('touchend', (e) => { e.preventDefault(); void this.handleConfirm() })
    cancelBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.close() })
    confirmBtn.addEventListener('click', () => { void this.handleConfirm() })
    cancelBtn.addEventListener('click', () => this.close())

    // Also fix Obsidian's built-in X close button
    const closeBtn = this.modalEl.querySelector<HTMLElement>('.modal-close-button')
    closeBtn?.addEventListener('touchend', (e) => { e.preventDefault(); this.close() })

    // Sync modal position with keyboard visibility:
    // - text/number input focused → keyboard opens → modal moves to top
    // - select/date focused → keyboard closes → modal returns to center
    this.contentEl.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'number')) {
        this.containerEl.addClass('pw-modal-keyboard-open')
      } else if (target instanceof HTMLSelectElement ||
                 (target instanceof HTMLInputElement && target.type === 'date')) {
        this.containerEl.removeClass('pw-modal-keyboard-open')
      }
    })
  }

  private renderTypeTabs() {
    this.typeTabsEl.empty()
    const types: TransactionType[] = ['expense', 'income', 'transfer']
    for (const tp of types) {
      const tab = this.typeTabsEl.createEl('button', {
        text: t(`type.${tp}`),
        cls: 'pw-type-tab' + (this.type === tp ? ' is-active' : ''),
      })
      tab.dataset['type'] = tp
    // Update active tab immediately on touch, rebuild after touch ends
      tab.addEventListener('touchend', (e) => {
        e.preventDefault()
        this.containerEl.removeClass('pw-modal-keyboard-open')
        this.resetStateForType(tp)
        Array.from(this.typeTabsEl.children).forEach((el, i) => {
          el.classList.toggle('is-active', types[i] === tp)
        })
        this.renderFields(this.walletFile.getConfig(), false)
        // Defer full tab rebuild until after touch sequence ends
        setTimeout(() => this.renderTypeTabs(), 50)
      })
      tab.addEventListener('click', () => {
        this.resetStateForType(tp)
        this.renderTypeTabs()
        this.renderFields(this.walletFile.getConfig(), false)
      })
    }
  }

  private renderFields(config: PennyWalletConfig, autoFocus = true) {
    this.fieldsEl.empty()
    this.amountPrefixEl = null

    // Remove keyboard-open class on touchstart so modal repositions BEFORE the native picker opens.
    const onPickerTouch = (el: HTMLElement) => {
      el.addEventListener('touchstart', () => {
        this.containerEl.removeClass('pw-modal-keyboard-open')
      }, { passive: true })
    }

    // Refund row first (expense only) — sub-option of the type tab, visually adjacent.
    if (this.type === 'expense') {
      this.addRefundRow(this.fieldsEl)
    }

    // Date field (always shown)
    this.addField(this.fieldsEl, t('modal.date'), () => {
      const input = createEl('input', { type: 'date' })
      input.value = this.date
      input.addEventListener('change', () => { this.date = input.value })
      onPickerTouch(input)
      return input
    })

    const activeWallets = this.getActiveWallets(config)

    if (this.type === 'expense' || this.type === 'income') {
      const categories = this.getCategoryOptions(config)
      this.addField(this.fieldsEl, t('modal.category'), () => {
        const sel = createEl('select')
        sel.createEl('option', { text: '—', value: '' })
        for (const { key, label } of categories) {
          const opt = sel.createEl('option', { text: label, value: key })
          if (key === this.category) opt.selected = true
        }
        sel.addEventListener('change', () => { this.category = sel.value })
        onPickerTouch(sel)
        return sel
      })

      this.addField(this.fieldsEl, t('modal.wallet'), () => {
        const sel = createEl('select')
        sel.createEl('option', { text: '—', value: '' })
        const walletOptions = this.type === 'income'
          ? activeWallets.filter(w => w.type !== 'creditCard')
          : activeWallets
        for (const w of walletOptions) {
          const opt = sel.createEl('option', { text: w.name, value: w.name })
          if (w.name === this.wallet) opt.selected = true
        }
        sel.addEventListener('change', () => { this.wallet = sel.value })
        onPickerTouch(sel)
        return sel
      })

    } else {
      const categories = this.getCategoryOptions(config)
      this.addField(this.fieldsEl, t('modal.category'), () => {
        const sel = createEl('select')
        sel.createEl('option', { text: '—', value: '' })
        for (const { key, label } of categories) {
          const opt = sel.createEl('option', { text: label, value: key })
          if (key === this.category) opt.selected = true
        }
        sel.addEventListener('change', () => {
          this.category = sel.value
          this.renderFields(config, false)
        })
        onPickerTouch(sel)
        return sel
      })

      // Normalize wallet state when category constrains wallet types
      this.normalizeWalletForCategory(config)

      const { fromCandidates: fromWallets, toCandidates: toWallets }
        = getTransferWalletCandidates(activeWallets, this.category)

      this.addField(this.fieldsEl, t('modal.fromWallet'), () => {
        const sel = createEl('select')
        sel.createEl('option', { text: '—', value: '' })
        for (const w of fromWallets) {
          const opt = sel.createEl('option', { text: w.name, value: w.name })
          if (w.name === this.fromWallet) opt.selected = true
        }
        sel.addEventListener('change', () => { this.fromWallet = sel.value })
        onPickerTouch(sel)
        return sel
      })

      this.addField(this.fieldsEl, t('modal.toWallet'), () => {
        const sel = createEl('select')
        sel.createEl('option', { text: '—', value: '' })
        for (const w of toWallets) {
          const opt = sel.createEl('option', { text: w.name, value: w.name })
          if (w.name === this.toWallet) opt.selected = true
        }
        sel.addEventListener('change', () => { this.toWallet = sel.value })
        onPickerTouch(sel)
        return sel
      })
    }

    this.addField(this.fieldsEl, t('modal.tags'), () => {
      return this.buildTagInput(this.walletFile.getConfig().tags)
    })

    this.addField(this.fieldsEl, t('modal.note'), () => {
      const input = createEl('input', { type: 'text', placeholder: t('modal.note') })
      input.value = this.note
      input.setAttribute('enterkeyhint', 'done')
      input.addEventListener('input', () => { this.note = input.value })
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur() })
      return input
    })

    const amountRow = this.fieldsEl.createDiv('pw-field-row')
    amountRow.createEl('label', { text: t('modal.amount'), cls: 'pw-field-label' })
    const amountWrapper = amountRow.createDiv('pw-amount-field-wrapper pw-field-input')
    this.amountPrefixEl = amountWrapper.createSpan({ cls: 'pw-amount-prefix', text: '+' })
    const dp = this.walletFile.getConfig().decimalPlaces ?? 0
    const amountInput = amountWrapper.createEl('input', { type: 'number', placeholder: dp === 2 ? '0.00' : '0' })
    amountInput.value = this.amount
    amountInput.setAttribute('min', '0')
    amountInput.setAttribute('step', dp === 2 ? '0.01' : '1')
    amountInput.setAttribute('enterkeyhint', 'done')
    amountInput.addEventListener('input', () => {
      this.amount = amountInput.value
      this.updateDesktopAmountPrefix()
    })
    amountInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') amountInput.blur() })
    this.updateDesktopAmountPrefix()
    if (autoFocus) setTimeout(() => amountInput.focus(), 50) // wait for modal open animation to complete
  }

  private addField(container: HTMLElement, label: string, buildInput: () => HTMLElement) {
    const row = container.createDiv('pw-field-row')
    row.createEl('label', { text: label, cls: 'pw-field-label' })
    const input = buildInput()
    input.addClass('pw-field-input')
    row.appendChild(input)
  }

  private addRefundRow(container: HTMLElement) {
    const block = container.createDiv('pw-refund-block')
    const row = block.createDiv('pw-field-row pw-refund-row')
    row.setAttribute('title', t('modal.isRefund.hint'))
    const checkboxId = 'pw-refund-checkbox'
    row.createEl('label', { text: t('modal.isRefund'), cls: 'pw-field-label', attr: { for: checkboxId } })
    const checkbox = createEl('input', { type: 'checkbox' })
    checkbox.id = checkboxId
    checkbox.checked = this.isRefund
    checkbox.addClass('pw-field-input')
    checkbox.addEventListener('change', () => {
      this.isRefund = checkbox.checked
      this.updateDesktopAmountPrefix()
    })
    row.appendChild(checkbox)
  }

  private updateDesktopAmountPrefix() {
    if (!this.amountPrefixEl) return
    const shouldShow = this.isRefund && this.amount !== ''
    this.amountPrefixEl.toggleClass('is-visible', shouldShow)
  }

  private buildTagInput(availableTags: string[]): HTMLElement {
    const wrapper = createDiv('pw-tag-input-wrapper')
    const chipsEl = wrapper.createDiv('pw-tag-chips')
    const input = wrapper.createEl('input', {
      type: 'text',
      cls: 'pw-tag-input',
      placeholder: t('modal.tagsPlaceholder'),
    })
    input.setAttribute('enterkeyhint', 'done')
    const dropdown = wrapper.createDiv('pw-tag-dropdown')
    dropdown.hide()

    const updateDropdown = () => {
      const val = input.value.replace(/^#/, '').toLowerCase()
      const suggestions = availableTags.filter(tag =>
        !this.tags.includes(tag) && (val === '' || tag.toLowerCase().includes(val))
      )
      dropdown.empty()
      if (suggestions.length === 0) { dropdown.hide(); return }
      for (const tag of suggestions) {
        const item = dropdown.createDiv({ cls: 'pw-tag-dropdown-item', text: tag })
        item.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(tag); updateDropdown() })
      }
      const rect = input.getBoundingClientRect()
      dropdown.style.left = `${rect.left}px`
      dropdown.style.top = `${rect.bottom + 2}px`
      dropdown.style.width = `${rect.width}px`
      dropdown.show()
    }

    const renderChips = () => {
      chipsEl.empty()
      for (const tag of this.tags) {
        const chip = chipsEl.createSpan('pw-tag-chip')
        chip.createSpan({ text: `#${tag}` })
        const x = chip.createSpan({ text: '×', cls: 'pw-tag-chip-remove' })
        x.addEventListener('click', () => {
          this.tags = this.tags.filter(tg => tg !== tag)
          renderChips()
          if (this.tags.length < 3) input.removeAttribute('disabled')
        })
      }
    }

    const addTag = (value?: string) => {
      const result = addTagToList(this.tags, value ?? input.value)
      switch (result.kind) {
        case 'empty':
        case 'max':
          return
        case 'invalid':
        case 'duplicate':
          input.value = ''
          dropdown.hide()
          return
        case 'added':
          this.tags = result.next
          input.value = ''
          dropdown.hide()
          renderChips()
          if (this.tags.length >= 3) input.setAttribute('disabled', 'true')
          return
      }
    }

    input.addEventListener('input', updateDropdown)
    input.addEventListener('focus', updateDropdown)
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
      if (e.key === 'Escape') dropdown.hide()
    })
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.hide(), 150)
      addTag()
    })

    renderChips()
    if (this.tags.length >= 3) input.setAttribute('disabled', 'true')
    return wrapper
  }

  protected getActiveWallets(config: PennyWalletConfig) {
    return config.wallets.filter(w => w.status === 'active')
  }

  protected normalizeWalletForCategory(config: PennyWalletConfig): void {
    if (this.category !== 'credit_card_payment') return
    const fromType = config.wallets.find(w => w.name === this.fromWallet)?.type
    const toType   = config.wallets.find(w => w.name === this.toWallet)?.type
    if (fromType === 'creditCard') this.fromWallet = ''
    if (toType && toType !== 'creditCard') this.toWallet = ''
  }

  protected resetStateForType(newType: TransactionType): void {
    this.type = newType
    if (newType !== 'expense') this.isRefund = false
    if (newType === 'expense' || newType === 'income') {
      this.fromWallet = ''
      this.toWallet = ''
    } else {
      this.wallet = ''
    }
  }

  protected getCategoryOptions(config: PennyWalletConfig): { key: string; label: string }[] {
    return getCategoryOptionsFromState(config, this.type)
  }

  protected showError(msg: string) {
    this.errorEl.textContent = msg
    this.errorEl.show()
  }

  protected clearError() {
    this.errorEl.hide()
  }

  protected getFormState(): TransactionFormState {
    return {
      date: this.date,
      type: this.type,
      wallet: this.wallet,
      fromWallet: this.fromWallet,
      toWallet: this.toWallet,
      category: this.category,
      note: this.note,
      tags: this.tags,
      amount: this.amount,
      isRefund: this.isRefund,
    }
  }

  private validate(): boolean {
    this.clearError()
    const result = validateTransactionForm(this.getFormState(), this.walletFile.getConfig())
    if (!result.ok) {
      this.showError(t(result.errorKey))
      return false
    }
    return true
  }

  protected async handleConfirm() {
    if (!this.validate()) return

    const newTx = buildTransactionPayload(this.getFormState())
    const newYearMonth = dateToYearMonth(this.date)

    try {
      if (this.editingTx && this.editingYearMonth) {
        await this.walletFile.updateTransaction(
          this.editingTx, this.editingYearMonth,
          newTx, newYearMonth,
        )
      } else {
        await this.walletFile.writeTransaction(newTx, newYearMonth)
      }

      this.close()
      this.onSuccess?.()
      new Notice(t(this.editingTx ? 'notice.transactionUpdated' : 'notice.transactionAdded'))
    } catch (e) {
      this.showError(String(e))
    }
  }

  onClose() {
    this.containerEl.removeClass('pw-modal-keyboard-open')
    this.contentEl.empty()
    this.onDismiss?.()
  }
}

export function todayString(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
