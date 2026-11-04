export type AtomCount = Record<string, number>

export interface ChemicalTerm {
  formula: string
  atoms: AtomCount
  charge: number
}

export interface BalanceResult {
  reactants: ChemicalTerm[]
  products: ChemicalTerm[]
  coefficients: number[]
  elements: string[]
  leftCounts: AtomCount
  rightCounts: AtomCount
  leftCharge: number
  rightCharge: number
  arrow: string
  alreadyBalanced: boolean
  ignoredCoefficients: boolean
}

interface ParsedTerm extends ChemicalTerm {
  ignoredCoefficient: boolean
}

const SUBSCRIPTS: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
}

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-',
}

function normalize(input: string): string {
  return input
    .trim()
    .replace(/[₀-₉⁰-⁹⁺⁻]/g, (char) => SUBSCRIPTS[char] ?? SUPERSCRIPTS[char] ?? char)
    .replace(/\s+/g, ' ')
    .replace(/−/g, '-')
    .replace(/[⟶⇒]/g, '→')
    .replace(/[↔⇋]/g, '⇌')
}

function splitReaction(input: string): { left: string; right: string; arrow: string } {
  const match = input.match(/->|=>|=|→|⇌/)
  if (!match || match.index === undefined) {
    throw new Error('Separa los reactivos y los productos con =, → o ->.')
  }
  const left = input.slice(0, match.index).trim()
  const right = input.slice(match.index + match[0].length).trim()
  if (!left || !right || /->|=>|=|→|⇌/.test(right)) {
    throw new Error('La ecuación debe tener un solo lado de reactivos y uno de productos.')
  }
  return { left, right, arrow: match[0] === '⇌' ? '⇌' : '→' }
}

function splitTerms(side: string): string[] {
  const terms: string[] = []
  let start = 0
  let depth = 0
  for (let i = 0; i < side.length; i += 1) {
    const char = side[i]
    if ('([{'.includes(char)) depth += 1
    if (')]}'.includes(char)) depth -= 1
    if (char === '+' && depth === 0) {
      const before = side.slice(start, i)
      // A plus directly attached to a caret belongs to an ionic charge (Fe^2+).
      if (/\^\d*$/.test(before.trim())) continue
      const term = side.slice(start, i).trim()
      if (!term) throw new Error('Hay un signo + sin una fórmula a su lado.')
      terms.push(term)
      start = i + 1
    }
  }
  const last = side.slice(start).trim()
  if (!last) throw new Error('Hay un signo + sin una fórmula a su lado.')
  terms.push(last)
  return terms
}

function addAtoms(target: AtomCount, source: AtomCount, multiplier = 1): void {
  Object.entries(source).forEach(([element, count]) => {
    target[element] = (target[element] ?? 0) + count * multiplier
  })
}

function readNumber(text: string, index: number): { value: number; next: number } {
  let next = index
  while (next < text.length && /\d/.test(text[next])) next += 1
  if (next === index) return { value: 1, next }
  const value = Number(text.slice(index, next))
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('Los subíndices deben ser números enteros positivos.')
  }
  return { value, next }
}

function parseGroup(text: string, start = 0, closing?: string): { atoms: AtomCount; next: number } {
  const atoms: AtomCount = {}
  let i = start
  while (i < text.length) {
    const char = text[i]
    if (closing && char === closing) return { atoms, next: i + 1 }
    if (')]}'.includes(char)) throw new Error(`Paréntesis o corchetes sin abrir en «${text}».`)

    if ('([{'.includes(char)) {
      const expected = char === '(' ? ')' : char === '[' ? ']' : '}'
      const group = parseGroup(text, i + 1, expected)
      const multiplier = readNumber(text, group.next)
      addAtoms(atoms, group.atoms, multiplier.value)
      i = multiplier.next
      continue
    }

    if (/[A-Z]/.test(char)) {
      let element = char
      let next = i + 1
      if (next < text.length && /[a-z]/.test(text[next])) {
        element += text[next]
        next += 1
      }
      const count = readNumber(text, next)
      atoms[element] = (atoms[element] ?? 0) + count.value
      i = count.next
      continue
    }

    throw new Error(`No reconozco «${char}» en «${text}». Revisa mayúsculas, minúsculas y paréntesis.`)
  }
  if (closing) throw new Error(`Falta cerrar un grupo en «${text}».`)
  return { atoms, next: i }
}

function parseTerm(rawTerm: string): ParsedTerm {
  let term = rawTerm.trim().replace(/\((?:s|l|g|aq)\)$/i, '').trim()
  if (!term) throw new Error('Hay una fórmula vacía en la ecuación.')

  let charge = 0
  const chargeMatch = term.match(/\^(\d*)([+-])$/)
  if (chargeMatch) {
    const magnitude = chargeMatch[1] ? Number(chargeMatch[1]) : 1
    charge = chargeMatch[2] === '+' ? magnitude : -magnitude
    term = term.slice(0, chargeMatch.index).trim()
  }

  if (/^e(?:-)?$/i.test(term)) {
    if (charge !== 0 && charge !== -1) throw new Error('El electrón solo admite carga −1.')
    return { formula: 'e⁻', atoms: {}, charge: -1, ignoredCoefficient: false }
  }

  let ignoredCoefficient = false
  const leading = term.match(/^(\d+)(?=[A-Z([{])/)
  if (leading) {
    ignoredCoefficient = true
    term = term.slice(leading[1].length)
  }

  const segments = term.split(/[·•*]/)
  if (segments.some((segment) => !segment)) {
    throw new Error(`Revisa el hidrato «${rawTerm}»: falta una fórmula junto al punto.`)
  }

  const atoms: AtomCount = {}
  segments.forEach((rawSegment, segmentIndex) => {
    let segment = rawSegment
    let multiplier = 1
    if (segmentIndex > 0) {
      const amount = segment.match(/^\d+/)
      if (amount) {
        multiplier = Number(amount[0])
        segment = segment.slice(amount[0].length)
      }
    }
    const parsed = parseGroup(segment)
    if (parsed.next !== segment.length || Object.keys(parsed.atoms).length === 0) {
      throw new Error(`La fórmula «${rawTerm}» no parece completa.`)
    }
    addAtoms(atoms, parsed.atoms, multiplier)
  })

  return { formula: term, atoms, charge, ignoredCoefficient }
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y) [x, y] = [y, x % y]
  return x
}

function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n
  return (a / gcd(a, b)) * b
}

class Fraction {
  readonly n: bigint
  readonly d: bigint

  constructor(numerator: bigint | number, denominator: bigint | number = 1n) {
    let n = BigInt(numerator)
    let d = BigInt(denominator)
    if (d === 0n) throw new Error('División entre cero durante el cálculo.')
    if (d < 0n) { n = -n; d = -d }
    const divisor = gcd(n, d) || 1n
    this.n = n / divisor
    this.d = d / divisor
  }

  add(other: Fraction): Fraction {
    return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d)
  }

  sub(other: Fraction): Fraction {
    return this.add(other.neg())
  }

  mul(other: Fraction): Fraction {
    return new Fraction(this.n * other.n, this.d * other.d)
  }

  div(other: Fraction): Fraction {
    return new Fraction(this.n * other.d, this.d * other.n)
  }

  neg(): Fraction { return new Fraction(-this.n, this.d) }
  isZero(): boolean { return this.n === 0n }
  isNegative(): boolean { return this.n < 0n }
}

function solveCoefficients(
  terms: ParsedTerm[],
  reactantCount: number,
  elements: string[],
  hasCharge: boolean,
): number[] {
  const rowNames = hasCharge ? [...elements, '__charge__'] : elements
  const matrix = rowNames.map((element) => terms.map((term, index) => {
    const value = element === '__charge__' ? term.charge : (term.atoms[element] ?? 0)
    return new Fraction(index < reactantCount ? value : -value)
  }))

  const rowCount = matrix.length
  const columnCount = terms.length
  const pivotColumns: number[] = []
  let pivotRow = 0

  for (let column = 0; column < columnCount && pivotRow < rowCount; column += 1) {
    let selected = pivotRow
    while (selected < rowCount && matrix[selected][column].isZero()) selected += 1
    if (selected === rowCount) continue
    ;[matrix[pivotRow], matrix[selected]] = [matrix[selected], matrix[pivotRow]]

    const pivot = matrix[pivotRow][column]
    matrix[pivotRow] = matrix[pivotRow].map((value) => value.div(pivot))
    for (let row = 0; row < rowCount; row += 1) {
      if (row === pivotRow || matrix[row][column].isZero()) continue
      const factor = matrix[row][column]
      matrix[row] = matrix[row].map((value, col) => value.sub(factor.mul(matrix[pivotRow][col])))
    }
    pivotColumns.push(column)
    pivotRow += 1
  }

  const freeColumns = Array.from({ length: columnCount }, (_, index) => index)
    .filter((index) => !pivotColumns.includes(index))
  if (freeColumns.length !== 1) {
    throw new Error('No existe una solución entera positiva única. Revisa las fórmulas y que la reacción esté completa.')
  }

  const free = freeColumns[0]
  const solution = Array.from({ length: columnCount }, () => new Fraction(0))
  solution[free] = new Fraction(1)
  pivotColumns.forEach((column, row) => {
    solution[column] = matrix[row][free].neg()
  })

  if (solution.every((value) => value.isNegative())) {
    solution.forEach((value, index) => { solution[index] = value.neg() })
  }
  if (solution.some((value) => value.isZero() || value.isNegative())) {
    throw new Error('Esta ecuación no admite coeficientes positivos con las fórmulas escritas. Revisa reactivos y productos.')
  }

  let commonDenominator = 1n
  solution.forEach((value) => { commonDenominator = lcm(commonDenominator, value.d) })
  const integers = solution.map((value) => value.n * (commonDenominator / value.d))
  const divisor = integers.reduce<bigint>((acc, value) => gcd(acc, value), 0n) || 1n
  return integers.map((value) => Number(value / divisor))
}

function countSide(terms: ChemicalTerm[], coefficients: number[], offset: number): { atoms: AtomCount; charge: number } {
  const atoms: AtomCount = {}
  let charge = 0
  terms.forEach((term, index) => {
    addAtoms(atoms, term.atoms, coefficients[offset + index])
    charge += term.charge * coefficients[offset + index]
  })
  return { atoms, charge }
}

export function balanceEquation(input: string): BalanceResult {
  const normalized = normalize(input)
  if (!normalized) throw new Error('Escribe una ecuación química para comenzar.')
  const { left: leftSide, right: rightSide, arrow } = splitReaction(normalized)
  const reactants = splitTerms(leftSide).map(parseTerm)
  const products = splitTerms(rightSide).map(parseTerm)
  const terms = [...reactants, ...products]
  if (terms.length < 2) throw new Error('Necesito al menos un reactivo y un producto.')

  const elements: string[] = []
  terms.forEach((term) => Object.keys(term.atoms).forEach((element) => {
    if (!elements.includes(element)) elements.push(element)
  }))
  const hasCharge = terms.some((term) => term.charge !== 0)
  if (elements.length === 0 && !hasCharge) throw new Error('No encontré elementos químicos en la ecuación.')

  const coefficients = solveCoefficients(terms, reactants.length, elements, hasCharge)
  const left = countSide(reactants, coefficients, 0)
  const right = countSide(products, coefficients, reactants.length)

  return {
    reactants: reactants.map(({ formula, atoms, charge }) => ({ formula, atoms, charge })),
    products: products.map(({ formula, atoms, charge }) => ({ formula, atoms, charge })),
    coefficients,
    elements,
    leftCounts: left.atoms,
    rightCounts: right.atoms,
    leftCharge: left.charge,
    rightCharge: right.charge,
    arrow,
    alreadyBalanced: coefficients.every((coefficient) => coefficient === 1),
    ignoredCoefficients: terms.some((term) => term.ignoredCoefficient),
  }
}

export function equationToPlainText(result: BalanceResult): string {
  const formatSide = (terms: ChemicalTerm[], offset: number) => terms.map((term, index) => {
    const coefficient = result.coefficients[offset + index]
    const charge = term.charge === 0 || term.formula === 'e⁻' ? '' : `^${Math.abs(term.charge) === 1 ? '' : Math.abs(term.charge)}${term.charge > 0 ? '+' : '-'}`
    return `${coefficient === 1 ? '' : coefficient}${term.formula}${charge}`
  }).join(' + ')
  return `${formatSide(result.reactants, 0)} ${result.arrow} ${formatSide(result.products, result.reactants.length)}`
}
