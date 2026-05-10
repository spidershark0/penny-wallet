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

  it('calculates a complete addition expression and clears the formula', () => {
    const state = pressAll(['1', '0', '0', '+', '2', '0', '='])
    expect(state.amountValue).toBe('120')
    expect(state.expressionText).toBe('')
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
    expect(state.expressionText).toBe('')
  })

  it('keeps the running history while chaining operators', () => {
    const state = pressAll(['1', '0', '0', '+', '2', '0', '×', '3'])
    expect(state.amountValue).toBe('3')
    expect(state.expressionText).toBe('100 + 20 × 3')
    expect(state.isPendingExpression).toBe(true)
  })

  it('keeps the running history when a new operator is just pressed', () => {
    const state = pressAll(['1', '0', '0', '+', '2', '0', '×'])
    expect(state.amountValue).toBe('120')
    expect(state.expressionText).toBe('100 + 20 ×')
  })

  it('replaces a pending operator without growing the history', () => {
    const state = pressAll(['1', '0', '0', '+', '-'])
    expect(state.expressionText).toBe('100 -')
  })

  it('clears the history after = and starts fresh on the next operator', () => {
    const state = pressAll(['1', '0', '0', '+', '2', '0', '=', '+', '5'])
    expect(state.amountValue).toBe('5')
    expect(state.expressionText).toBe('120 + 5')
  })

  it('rounds division results to config decimal places', () => {
    const state = pressAll(['1', '0', '÷', '3', '='], '', 2)
    expect(state.amountValue).toBe('3.33')
    expect(state.expressionText).toBe('')
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

  it('backspace removes last digit from amount', () => {
    const state = pressAll(['1', '2', '3', '⌫'])
    expect(state.amountValue).toBe('12')
    expect(state.expressionText).toBe('')
    expect(state.submitBlocker).toBeUndefined()
  })

  it('backspace removes last digit of right operand', () => {
    const state = pressAll(['1', '0', '+', '2', '0', '⌫'])
    expect(state.amountValue).toBe('2')
    expect(state.expressionText).toBe('10 + 2')
    expect(state.isPendingExpression).toBe(true)
  })

  it('backspace on single right operand digit returns to operator-pending state', () => {
    const state = pressAll(['1', '0', '+', '5', '⌫'])
    expect(state.amountValue).toBe('10')
    expect(state.expressionText).toBe('10 +')
    expect(state.isPendingExpression).toBe(true)
  })

  it('backspace on operator-pending state removes the operator', () => {
    const state = pressAll(['1', '0', '+', '⌫'])
    expect(state.amountValue).toBe('10')
    expect(state.expressionText).toBe('')
    expect(state.operator).toBeNull()
    expect(state.isPendingExpression).toBe(false)
    expect(state.submitBlocker).toBeUndefined()
  })

  it('backspace does nothing on resolved state', () => {
    const before = pressAll(['5', '+', '3', '='])
    const after = pressAll(['5', '+', '3', '=', '⌫'])
    expect(after.amountValue).toBe(before.amountValue)
    expect(after.isResolved).toBe(true)
  })

  it('00 appends double zero to the current number', () => {
    const state = pressAll(['5', '00'])
    expect(state.amountValue).toBe('500')
  })

  it('00 when amount is empty produces 0', () => {
    const state = pressAll(['00'])
    expect(state.amountValue).toBe('0')
  })

  it('can initialize from the modal amount', () => {
    const state = pressAll(['+', '8', '='], '12')
    expect(state.amountValue).toBe('20')
    expect(state.expressionText).toBe('')
  })
})
