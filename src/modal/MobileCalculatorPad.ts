import { t } from '../i18n'
import type { MobileCalculatorKey, MobileCalculatorState } from './mobileCalculatorState'

interface MobileCalculatorPadParams {
  parentEl: HTMLElement
  initialState: MobileCalculatorState
  onKey: (key: MobileCalculatorKey) => void
}

const keyRows: MobileCalculatorKey[][] = [
  ['C', '⌫', '÷', '×'],
  ['7', '8', '9', '-'],
  ['4', '5', '6', '+'],
  ['1', '2', '3'],
  ['00', '0', '.'],
]

export class MobileCalculatorPad {
  private rootEl: HTMLElement
  private errorEl: HTMLElement
  private state: MobileCalculatorState
  private onKey: (key: MobileCalculatorKey) => void

  constructor(params: MobileCalculatorPadParams) {
    this.state = params.initialState
    this.onKey = params.onKey
    this.rootEl = params.parentEl.createDiv('pw-mobile-calculator-pad')
    this.errorEl = this.rootEl.createDiv('pw-mobile-calculator-error')
    this.renderKeys()
    this.update(this.state)
  }

  update(state: MobileCalculatorState) {
    this.state = state
    this.errorEl.textContent = state.errorKey ? t(state.errorKey) : ''
    this.errorEl.toggleClass('is-visible', Boolean(state.errorKey))
  }

  remove() {
    this.rootEl.remove()
  }

  private renderKeys() {
    const gridEl = this.rootEl.createDiv('pw-mobile-calculator-grid')
    for (const row of keyRows) {
      for (const key of row) {
        const btn = gridEl.createEl('button', {
          cls: this.getButtonClass(key),
          text: key,
        })
        btn.dataset['calculatorKey'] = key
        this.bindButton(btn, key)
      }
    }
    const equalsBtn = gridEl.createEl('button', {
      cls: this.getButtonClass('='),
      text: '=',
    })
    equalsBtn.dataset['calculatorKey'] = '='
    this.bindButton(equalsBtn, '=')
  }

  private getButtonClass(key: MobileCalculatorKey): string {
    const classes = ['pw-mobile-calculator-btn']
    if (['+', '-', '×', '÷'].includes(key)) classes.push('pw-mobile-calculator-operator')
    if (key === 'C' || key === '⌫') classes.push('pw-mobile-calculator-clear')
    if (key === '=') classes.push('pw-mobile-calculator-equals')
    return classes.join(' ')
  }

  private bindButton(btn: HTMLButtonElement, key: MobileCalculatorKey) {
    let touched = false
    let clearPressedTimer: number | null = null
    const setPressed = () => {
      if (clearPressedTimer !== null) {
        window.clearTimeout(clearPressedTimer)
        clearPressedTimer = null
      }
      btn.addClass('is-pressed')
    }
    const clearPressed = () => {
      btn.removeClass('is-pressed')
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
      this.onKey(key)
      scheduleClearPressed()
    })
    btn.addEventListener('click', () => {
      if (touched) {
        touched = false
        return
      }
      this.onKey(key)
      scheduleClearPressed()
    })
  }
}
