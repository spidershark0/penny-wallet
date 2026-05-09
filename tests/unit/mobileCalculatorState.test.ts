import { describe, it, expect } from 'vitest'
import {
  createMobileCalculatorState,
  pressMobileCalculatorKey,
} from '../../src/modal/mobileCalculatorState'

function pressAll(keys: string[], initialAmount = '', decimalPlaces = 2) {
  return keys.reduce(
    (state, key) => pressMobileCalculatorKey(state, key),
    createMobileCalculatorState(initialAmount, decimalPlaces),
  )
}

describe('mobile calculator state', () => {
  it('enters digits and decimal as amount value', () => {
    const state = pressAll(['1', '2', '.', '3'])
    expect(state.amountValue).toBe('12.3')
    expect(state.expressionText).toBe('')
    expect(state.submitBlocker).toBeUndefined()
  })

  it('prevents multiple decimals in the active number', () => {
    const state = pressAll(['1', '.', '2', '.', '3'])
    expect(state.amountValue).toBe('1.23')
  })

  it('ignores decimal point when config disallows decimals', () => {
    const state = pressAll(['1', '.', '2'], '', 0)
    expect(state.amountValue).toBe('12')
  })

  it('limits typed fractional digits to config decimal places', () => {
    const state = pressAll(['1', '.', '2', '3', '4'], '', 2)
    expect(state.amountValue).toBe('1.23')
  })

  it('calculates a complete addition expression and keeps the resolved formula', () => {
    const state = pressAll(['1', '0', '0', '+', '2', '0', '='])
    expect(state.amountValue).toBe('120')
    expect(state.expressionText).toBe('100 + 20 =')
    expect(state.isPendingExpression).toBe(false)
    expect(state.isResolved).toBe(true)
    expect(state.submitBlocker).toBeUndefined()
  })

  it('blocks submit while an expression is pending', () => {
    const state = pressAll(['1', '0', '0', '+', '2', '0'])
    expect(state.amountValue).toBe('20')
    expect(state.expressionText).toBe('100 + 20')
    expect(state.isPendingExpression).toBe(true)
    expect(state.submitBlocker).toBe('calculator.err.pendingExpression')
  })

  it('uses left-to-right calculation for chained operators', () => {
    const state = pressAll(['1', '0', '0', '+', '2', '0', '×', '3', '='])
    expect(state.amountValue).toBe('360')
    expect(state.expressionText).toBe('120 × 3 =')
  })

  it('rounds division results to config decimal places', () => {
    const state = pressAll(['1', '0', '÷', '3', '='], '', 2)
    expect(state.amountValue).toBe('3.33')
    expect(state.expressionText).toBe('10 ÷ 3 =')
  })

  it('clears amount and expression with C', () => {
    const state = pressAll(['1', '0', '0', '+', '2', '0', 'C'])
    expect(state.amountValue).toBe('')
    expect(state.expressionText).toBe('')
    expect(state.isPendingExpression).toBe(false)
    expect(state.isResolved).toBe(false)
    expect(state.errorKey).toBeUndefined()
  })

  it('starts a fresh amount after a resolved expression when a digit is pressed', () => {
    const state = pressAll(['1', '0', '0', '+', '2', '0', '=', '5'])
    expect(state.amountValue).toBe('5')
    expect(state.expressionText).toBe('')
    expect(state.isResolved).toBe(false)
  })

  it('rejects negative results and keeps the previous amount', () => {
    const state = pressAll(['2', '0', '-', '1', '0', '0', '='])
    expect(state.amountValue).toBe('100')
    expect(state.expressionText).toBe('20 - 100')
    expect(state.errorKey).toBe('calculator.err.negativeResult')
    expect(state.isPendingExpression).toBe(true)
    expect(state.submitBlocker).toBe('calculator.err.pendingExpression')
  })

  it('ignores operators when there is no amount', () => {
    const state = pressAll(['+', '5'])
    expect(state.amountValue).toBe('5')
    expect(state.expressionText).toBe('')
  })

  it('can initialize from the modal amount', () => {
    const state = pressAll(['+', '8', '='], '12')
    expect(state.amountValue).toBe('20')
    expect(state.expressionText).toBe('12 + 8 =')
  })
})
