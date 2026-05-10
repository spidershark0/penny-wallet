export type MobileCalculatorOperator = '+' | '-' | '×' | '÷'
export type MobileCalculatorKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | MobileCalculatorOperator | '=' | 'C'
export type MobileCalculatorErrorKey =
  | 'calculator.err.pendingExpression'
  | 'calculator.err.negativeResult'
  | 'calculator.err.divideByZero'

export interface MobileCalculatorState {
  amountValue: string
  expressionText: string
  decimalPlaces: number
  leftOperand: string
  operator: MobileCalculatorOperator | null
  rightOperand: string
  isPendingExpression: boolean
  isResolved: boolean
  errorKey?: MobileCalculatorErrorKey
  submitBlocker?: MobileCalculatorErrorKey
}

const operators = new Set<string>(['+', '-', '×', '÷'])

export function createMobileCalculatorState(initialAmount = '', decimalPlaces = 0): MobileCalculatorState {
  return buildState({
    amountValue: normalizeAmountString(initialAmount),
    expressionText: '',
    decimalPlaces,
    leftOperand: '',
    operator: null,
    rightOperand: '',
    isPendingExpression: false,
    isResolved: false,
  })
}

export function pressMobileCalculatorKey(
  state: MobileCalculatorState,
  key: string,
): MobileCalculatorState {
  if (key === 'C') return createMobileCalculatorState('', state.decimalPlaces)
  if (key === '=') return resolveExpression(state)
  if (operators.has(key)) return pressOperator(state, key as MobileCalculatorOperator)
  if (key === '.' || /^\d$/.test(key)) return pressNumberKey(state, key)
  return state
}

function pressNumberKey(state: MobileCalculatorState, key: string): MobileCalculatorState {
  const fresh = state.isResolved
    ? createMobileCalculatorState('', state.decimalPlaces)
    : { ...state, errorKey: undefined }
  const target = fresh.operator ? fresh.rightOperand : fresh.amountValue
  const nextNumber = appendNumberKey(target, key, fresh.decimalPlaces)

  if (fresh.operator) {
    return buildState({
      ...fresh,
      rightOperand: nextNumber,
      amountValue: nextNumber,
      expressionText: `${fresh.leftOperand} ${fresh.operator} ${nextNumber}`,
      isPendingExpression: true,
      isResolved: false,
    })
  }

  return buildState({
    ...fresh,
    amountValue: nextNumber,
    expressionText: '',
    isPendingExpression: false,
    isResolved: false,
  })
}

function pressOperator(
  state: MobileCalculatorState,
  nextOperator: MobileCalculatorOperator,
): MobileCalculatorState {
  if (state.isResolved) {
    return buildState({
      ...state,
      leftOperand: state.amountValue,
      operator: nextOperator,
      rightOperand: '',
      expressionText: `${state.amountValue} ${nextOperator}`,
      isPendingExpression: true,
      isResolved: false,
      errorKey: undefined,
    })
  }

  if (!state.operator) {
    if (!state.amountValue) return state
    return buildState({
      ...state,
      leftOperand: state.amountValue,
      operator: nextOperator,
      rightOperand: '',
      expressionText: `${state.amountValue} ${nextOperator}`,
      isPendingExpression: true,
      isResolved: false,
      errorKey: undefined,
    })
  }

  if (!state.rightOperand) {
    return buildState({
      ...state,
      operator: nextOperator,
      expressionText: `${state.leftOperand} ${nextOperator}`,
      errorKey: undefined,
    })
  }

  const folded = calculate(state.leftOperand, state.operator, state.rightOperand, state.decimalPlaces)
  if (folded.errorKey) {
    return buildState({ ...state, errorKey: folded.errorKey })
  }

  return buildState({
    ...state,
    amountValue: folded.value,
    leftOperand: folded.value,
    operator: nextOperator,
    rightOperand: '',
    expressionText: `${folded.value} ${nextOperator}`,
    isPendingExpression: true,
    isResolved: false,
    errorKey: undefined,
  })
}

function resolveExpression(state: MobileCalculatorState): MobileCalculatorState {
  if (!state.operator || !state.leftOperand || !state.rightOperand) return state

  const result = calculate(state.leftOperand, state.operator, state.rightOperand, state.decimalPlaces)
  if (result.errorKey) {
    return buildState({
      ...state,
      errorKey: result.errorKey,
      isPendingExpression: true,
      isResolved: false,
    })
  }

  return buildState({
    ...state,
    amountValue: result.value,
    expressionText: '',
    leftOperand: '',
    operator: null,
    rightOperand: '',
    isPendingExpression: false,
    isResolved: true,
    errorKey: undefined,
  })
}

function appendNumberKey(value: string, key: string, decimalPlaces: number): string {
  if (key === '.') {
    if (decimalPlaces === 0) return value
    if (value.includes('.')) return value
    return value === '' ? '0.' : `${value}.`
  }
  if (value.includes('.')) {
    const fraction = value.split('.')[1] ?? ''
    if (fraction.length >= decimalPlaces) return value
  }
  if (value === '0') return key
  return `${value}${key}`
}

function calculate(
  left: string,
  operator: MobileCalculatorOperator,
  right: string,
  decimalPlaces: number,
): { value: string; errorKey?: never } | { value?: never; errorKey: MobileCalculatorErrorKey } {
  const a = Number(left)
  const b = Number(right)
  const raw = operator === '+'
    ? a + b
    : operator === '-'
      ? a - b
      : operator === '×'
        ? a * b
        : b === 0
          ? Number.NaN
          : a / b

  if (!Number.isFinite(raw)) return { errorKey: 'calculator.err.divideByZero' }
  if (raw < 0) return { errorKey: 'calculator.err.negativeResult' }
  return { value: formatResult(raw, operator, decimalPlaces) }
}

function formatResult(value: number, operator: MobileCalculatorOperator, decimalPlaces: number): string {
  if (operator === '÷') return String(Number(value.toFixed(decimalPlaces)))
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toFixed(10)))
}

function normalizeAmountString(value: string): string {
  if (!value) return ''
  return value.replace(/^0+(?=\d)/, '')
}

function buildState(state: Omit<MobileCalculatorState, 'submitBlocker'>): MobileCalculatorState {
  const submitBlocker = state.isPendingExpression
    ? 'calculator.err.pendingExpression' as const
    : undefined
  return { ...state, submitBlocker }
}
