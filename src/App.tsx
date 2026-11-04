import { Fragment, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Eraser,
  FlaskConical,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  balanceEquation,
  equationToPlainText,
} from './lib/chemistry'
import type { BalanceResult, ChemicalTerm } from './lib/chemistry'
import './App.css'

const INITIAL_EQUATION = 'C3H8 + O2 = CO2 + H2O'
const EXAMPLES = [
  { label: 'Síntesis del agua', equation: 'H2 + O2 = H2O' },
  { label: 'Oxidación del hierro', equation: 'Fe + O2 = Fe2O3' },
  { label: 'Neutralización', equation: 'NaOH + H2SO4 = Na2SO4 + H2O' },
  { label: 'Grupos y paréntesis', equation: 'Ca(OH)2 + H3PO4 = Ca3(PO4)2 + H2O' },
]

const FLOWERS = [
  { className: 'flower-one', src: '/flor-lineal-1.png', duration: '12s', delay: '-4s' },
  { className: 'flower-two', src: '/flor-lineal-2.png', duration: '14s', delay: '-9s' },
  { className: 'flower-three', src: '/flor-lineal-1.png', duration: '11s', delay: '-7s' },
  { className: 'flower-four', src: '/flor-lineal-2.png', duration: '15s', delay: '-2s' },
  { className: 'flower-five', src: '/flor-lineal-1.png', duration: '13s', delay: '-10s' },
  { className: 'flower-six', src: '/flor-lineal-2.png', duration: '12s', delay: '-6s' },
]

function BotanicalDecor() {
  return (
    <div className="botanical-decor" aria-hidden="true">
      {FLOWERS.map((flower) => (
        <div
          className={`flower-instance ${flower.className}`}
          key={flower.className}
          style={{ animationDuration: flower.duration, animationDelay: flower.delay }}
        >
          <img src={flower.src} alt="" decoding="async" />
          <span className="flower-sparkle sparkle-a" />
          <span className="flower-sparkle sparkle-b" />
          <span className="flower-sparkle sparkle-c" />
        </div>
      ))}
    </div>
  )
}

function Formula({ term, withCharge = true }: { term: ChemicalTerm; withCharge?: boolean }): ReactNode {
  if (term.formula === 'e⁻') return <span>e<sup>−</sup></span>
  const nodes: ReactNode[] = []
  let cursor = 0
  Array.from(term.formula.matchAll(/\d+/g)).forEach((match, index) => {
    const start = match.index ?? 0
    if (start > cursor) nodes.push(<Fragment key={`text-${index}`}>{term.formula.slice(cursor, start)}</Fragment>)
    const isHydrateMultiplier = start > 0 && '·•*'.includes(term.formula[start - 1])
    nodes.push(isHydrateMultiplier
      ? <Fragment key={`number-${index}`}>{match[0]}</Fragment>
      : <sub key={`number-${index}`}>{match[0]}</sub>)
    cursor = start + match[0].length
  })
  if (cursor < term.formula.length) nodes.push(<Fragment key="final-text">{term.formula.slice(cursor)}</Fragment>)
  return (
    <span className="formula">
      {nodes}
      {withCharge && term.charge !== 0 && (
        <sup>{Math.abs(term.charge) === 1 ? '' : Math.abs(term.charge)}{term.charge > 0 ? '+' : '−'}</sup>
      )}
    </span>
  )
}

function EquationSide({ terms, coefficients, offset }: {
  terms: ChemicalTerm[]
  coefficients: number[]
  offset: number
}): ReactNode {
  return terms.map((term, index) => {
    const coefficient = coefficients[offset + index]
    return (
      <Fragment key={`${term.formula}-${index}`}>
        {index > 0 && <span className="equation-operator">+</span>}
        <span className="equation-species">
          {coefficient > 1 && <span className="equation-coefficient">{coefficient}</span>}
          <Formula term={term} />
        </span>
      </Fragment>
    )
  })
}

function variableName(index: number): string {
  return String.fromCharCode(97 + index)
}

function balanceRows(result: BalanceResult) {
  const labels = result.coefficients.map((_, index) => variableName(index))
  return result.elements.map((element) => {
    const expression = (terms: ChemicalTerm[], offset: number) => terms
      .map((term, index) => ({ count: term.atoms[element] ?? 0, label: labels[offset + index] }))
      .filter(({ count }) => count > 0)
      .map(({ count, label }) => `${count === 1 ? '' : count}${label}`)
      .join(' + ')
    return {
      element,
      left: expression(result.reactants, 0),
      right: expression(result.products, result.reactants.length),
    }
  })
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

export default function App() {
  const [input, setInput] = useState(INITIAL_EQUATION)
  const [result, setResult] = useState<BalanceResult | null>(() => balanceEquation(INITIAL_EQUATION))
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [methodOpen, setMethodOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const runBalance = (equation: string) => {
    try {
      const balanced = balanceEquation(equation)
      setResult(balanced)
      setError('')
      setCopied(false)
      setMethodOpen(false)
    } catch (caught) {
      setResult(null)
      setCopied(false)
      setError(caught instanceof Error ? caught.message : 'No pude balancear esta ecuación. Revisa la escritura.')
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    runBalance(input)
  }

  const selectExample = (equation: string) => {
    setInput(equation)
    runBalance(equation)
    const workspace = document.getElementById('balanceador')
    if (workspace) {
      const top = workspace.getBoundingClientRect().top + window.scrollY - 20
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const clear = () => {
    setInput('')
    setResult(null)
    setError('')
    setCopied(false)
    inputRef.current?.focus()
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await copyText(equationToPlainText(result))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('No pude copiar automáticamente. Selecciona la ecuación y cópiala manualmente.')
    }
  }

  const rows = result ? balanceRows(result) : []
  const hasCharge = result ? result.leftCharge !== 0 || result.rightCharge !== 0 ||
    [...result.reactants, ...result.products].some((term) => term.charge !== 0) : false

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <BotanicalDecor />

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Manrique Pharma, ir al inicio">
          <img src="/manrique-pharma.png" alt="" className="brand-mark" />
          <span className="brand-copy">
            <strong>Manrique <span className="brand-pharma">Pharma</span></strong>
            <small>Laboratorio digital</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <a href="#balanceador">Balanceador</a>
          <a href="#metodo">Método</a>
          <a href="#ejemplos">Ejemplos</a>
        </nav>
        <div className="system-status"><span /> Sistema listo</div>
      </header>

      <main id="inicio">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="kicker"><FlaskConical size={15} /> Estequiometría · Laboratorio 03</p>
            <h1 id="page-title">La materia, en<br /><em>perfecto equilibrio.</em></h1>
            <p className="hero-description">
              Escribe una reacción. Nosotros encontramos sus coeficientes mínimos y comprobamos que cada átomo permanezca donde la ley de conservación exige.
            </p>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit orbit-outer"><span className="orbit-dot" /></div>
            <div className="orbit orbit-inner"><span className="orbit-dot" /></div>
            <Sparkles className="orbit-spark" size={26} strokeWidth={1} />
            <div className="orbit-core"><Scale size={34} strokeWidth={1.2} /></div>
          </div>
        </section>

        <section className="workspace" id="balanceador" aria-label="Balanceador de ecuaciones">
          <div className="input-panel">
            <div className="panel-heading">
              <span className="panel-index">01 / ENTRADA</span>
              <span className="panel-note">Coeficientes enteros mínimos</span>
            </div>
            <form onSubmit={handleSubmit}>
              <label htmlFor="equation-input">Escribe tu ecuación química</label>
              <div className={`equation-input-wrap ${error ? 'has-error' : ''}`}>
                <input
                  ref={inputRef}
                  id="equation-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ej. H2 + O2 = H2O"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="input-help equation-error"
                />
                <button type="button" className="icon-button clear-button" onClick={clear} aria-label="Limpiar ecuación" title="Limpiar">
                  <Eraser size={19} />
                </button>
              </div>
              <div className="input-under-row">
                <p id="input-help">Usa <code>=</code>, <code>→</code> o <code>-&gt;</code>. También acepta ₂, paréntesis e iones como <code>Fe^2+</code>.</p>
                <span>{input.length}/160</span>
              </div>
              {error && <div className="error-message" id="equation-error" role="alert">{error}</div>}
              <button className="primary-button" type="submit" disabled={input.length > 160}>
                <span>Balancear ecuación</span>
                <ArrowRight size={19} />
              </button>
            </form>
            <div className="quick-examples" id="ejemplos">
              <span>Prueba con un ejemplo</span>
              <div className="example-list">
                {EXAMPLES.map((example) => (
                  <button key={example.equation} type="button" onClick={() => selectExample(example.equation)}>
                    {example.label}<ArrowRight size={13} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`result-panel ${result ? 'is-ready' : ''}`} aria-live="polite">
            <div className="panel-heading">
              <span className="panel-index">02 / RESULTADO</span>
              {result && (
                <span className="balanced-status"><Check size={13} /> {result.alreadyBalanced ? 'Ya balanceada' : 'Balanceada'}</span>
              )}
            </div>

            {result ? (
              <>
                <div className="result-equation">
                  <div className="equation-line">
                    <EquationSide terms={result.reactants} coefficients={result.coefficients} offset={0} />
                    <span className="equation-arrow">{result.arrow}</span>
                    <EquationSide terms={result.products} coefficients={result.coefficients} offset={result.reactants.length} />
                  </div>
                  <button type="button" className="copy-button" onClick={handleCopy}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiada' : 'Copiar ecuación'}
                  </button>
                </div>

                {result.ignoredCoefficients && (
                  <p className="coefficient-note">Reemplacé los coeficientes iniciales por los enteros mínimos correctos.</p>
                )}

                <div className="verification-heading">
                  <div>
                    <span>Comprobación de conservación</span>
                    <small>Reactivos y productos</small>
                  </div>
                  <ShieldCheck size={23} strokeWidth={1.4} />
                </div>
                <div className="atom-table-wrap">
                  <table className="atom-table">
                    <thead>
                      <tr><th>Elemento</th><th>Izquierda</th><th>Derecha</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {result.elements.map((element) => (
                        <tr key={element}>
                          <td><strong>{element}</strong></td>
                          <td>{result.leftCounts[element] ?? 0}</td>
                          <td>{result.rightCounts[element] ?? 0}</td>
                          <td><span className="table-check"><Check size={12} /> Igual</span></td>
                        </tr>
                      ))}
                      {hasCharge && (
                        <tr>
                          <td><strong>Carga neta</strong></td>
                          <td>{result.leftCharge}</td>
                          <td>{result.rightCharge}</td>
                          <td><span className="table-check"><Check size={12} /> Igual</span></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="empty-result">
                <Scale size={44} strokeWidth={1} />
                <h2>El equilibrio empieza aquí</h2>
                <p>Escribe una reacción completa y pulsa «Balancear ecuación». Verás el resultado y la cuenta de cada elemento.</p>
              </div>
            )}
          </div>
        </section>

        <section className="method-section" id="metodo" aria-labelledby="method-title">
          <div className="method-intro">
            <span className="panel-index">03 / BAJO LA SUPERFICIE</span>
            <h2 id="method-title">No es magia.<br />Es <em>conservación.</em></h2>
            <p>Cada elemento se convierte en una igualdad. El sistema resuelve todas a la vez y reduce la respuesta a sus enteros más pequeños.</p>
          </div>
          <div className="method-steps">
            <article>
              <span className="step-number">I</span>
              <div><h3>Asignar incógnitas</h3><p>Cada sustancia recibe una letra: a, b, c… Esa letra será su coeficiente.</p></div>
            </article>
            <article>
              <span className="step-number">II</span>
              <div><h3>Igualar los átomos</h3><p>La cantidad de cada elemento debe coincidir antes y después de la flecha.</p></div>
            </article>
            <article>
              <span className="step-number">III</span>
              <div><h3>Reducir y comprobar</h3><p>Se obtiene la proporción, se convierte en enteros mínimos y se verifica cada fila.</p></div>
            </article>
          </div>
        </section>

        {result && (
          <section className="worked-solution" aria-label="Desarrollo matemático de la ecuación actual">
            <button
              type="button"
              className="solution-toggle"
              onClick={() => setMethodOpen((open) => !open)}
              aria-expanded={methodOpen}
              aria-controls="solution-content"
            >
              <span><Sparkles size={17} /> Ver el desarrollo de esta ecuación</span>
              <ChevronDown size={20} className={methodOpen ? 'rotated' : ''} />
            </button>
            {methodOpen && (
              <div className="solution-content" id="solution-content">
                <div className="coefficient-assignment">
                  <span className="solution-label">1. Coeficientes como incógnitas</span>
                  <p>
                    {[...result.reactants, ...result.products].map((term, index) => (
                      <span className="assignment" key={`${term.formula}-${index}`}>
                        <b>{variableName(index)}</b><Formula term={term} />
                      </span>
                    ))}
                  </p>
                </div>
                <div className="equation-system">
                  <span className="solution-label">2. Una ecuación por elemento</span>
                  <div className="system-grid">
                    {rows.map((row) => (
                      <div className="system-row" key={row.element}>
                        <strong>{row.element}</strong><span>{row.left} = {row.right}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="integer-result">
                  <span className="solution-label">3. Relación entera mínima</span>
                  <p>{result.coefficients.map((coefficient, index) => `${variableName(index)} = ${coefficient}`).join('  ·  ')}</p>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="notation-note" aria-label="Notación admitida">
          <span>NOTACIÓN ADMITIDA</span>
          <p>Fórmulas con paréntesis <code>Ca(OH)2</code>, hidratos <code>CuSO4·5H2O</code>, estados <code>(s), (l), (g), (aq)</code> e iones <code>SO4^2-</code>.</p>
        </section>
      </main>

      <footer className="site-footer">
        <div><strong>Manrique Pharma</strong><span>Precisión para comprender la materia.</span></div>
        <p>Herramienta educativa · Verifica tus resultados en contextos experimentales.</p>
        <span>sitio creado por Mon</span>
      </footer>
    </div>
  )
}
