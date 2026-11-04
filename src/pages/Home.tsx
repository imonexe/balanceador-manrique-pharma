import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeftRight,
  Calculator,
  Check,
  Copy,
  RotateCcw,
  Scale,
  Sparkles,
} from 'lucide-react'
import {
  calculateDose,
  convertUnit,
  formatNumber,
  MASS_TO_MG,
  parseNumericInput,
  type DoseBasis,
  type MassUnit,
  type WeightUnit,
} from '../lib/calculations'
import '../App.css'

type Tool = 'converter' | 'dose'
type Category = 'mass' | 'volume' | 'weight'
type CopyTarget = 'converter' | 'dose' | null

const categories: Record<Category, {
  label: string
  units: Record<string, number>
  defaultFrom: string
  defaultTo: string
}> = {
  mass: {
    label: 'Masa',
    units: { mcg: MASS_TO_MG.mcg, mg: 1, g: 1000 },
    defaultFrom: 'mg',
    defaultTo: 'g',
  },
  volume: {
    label: 'Volumen',
    units: { mL: 1, L: 1000 },
    defaultFrom: 'mL',
    defaultTo: 'L',
  },
  weight: {
    label: 'Peso corporal',
    units: { kg: 1, lb: 0.45359237 },
    defaultFrom: 'kg',
    defaultTo: 'lb',
  },
}

const inputClass = 'field-input'
const selectClass = 'field-select'

async function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Algunos visores móviles bloquean esta API; usamos la alternativa compatible.
    }
  }
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

export default function Home() {
  const [activeTool, setActiveTool] = useState<Tool>('converter')
  const [copied, setCopied] = useState<CopyTarget>(null)

  const [category, setCategory] = useState<Category>('mass')
  const [amount, setAmount] = useState('250')
  const [fromUnit, setFromUnit] = useState('mg')
  const [toUnit, setToUnit] = useState('g')

  const [weight, setWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [dose, setDose] = useState('')
  const [doseUnit, setDoseUnit] = useState<MassUnit>('mg')
  const [basis, setBasis] = useState<DoseBasis>('perDose')
  const [frequency, setFrequency] = useState('3')
  const [concentrationAmount, setConcentrationAmount] = useState('')
  const [concentrationUnit, setConcentrationUnit] = useState<MassUnit>('mg')
  const [concentrationVolume, setConcentrationVolume] = useState('')

  const numericAmount = parseNumericInput(amount)
  const converted = useMemo(() => {
    if (!Number.isFinite(numericAmount)) return null
    return convertUnit(numericAmount, fromUnit, toUnit, categories[category].units)
  }, [numericAmount, fromUnit, toUnit, category])

  const numericWeight = parseNumericInput(weight)
  const numericDose = parseNumericInput(dose)
  const numericConcentration = parseNumericInput(concentrationAmount)
  const numericConcentrationVolume = parseNumericInput(concentrationVolume)
  const numericFrequency = Number(frequency)

  const weightInvalid = weight.trim() !== '' && (!(numericWeight > 0) || !Number.isFinite(numericWeight))
  const doseInvalid = dose.trim() !== '' && (!(numericDose > 0) || !Number.isFinite(numericDose))
  const doseReady = numericWeight > 0 && numericDose > 0 && numericFrequency > 0
  const concentrationStarted = concentrationAmount.trim() !== '' || concentrationVolume.trim() !== ''
  const concentrationValid = numericConcentration > 0 && numericConcentrationVolume > 0
  const concentrationInvalid = concentrationStarted && !concentrationValid

  const doseResult = useMemo(() => {
    if (!doseReady) return null
    return calculateDose({
      weight: numericWeight,
      weightUnit,
      dose: numericDose,
      doseUnit,
      basis,
      frequency: numericFrequency,
      concentrationAmount: concentrationValid ? numericConcentration : undefined,
      concentrationUnit,
      concentrationVolume: concentrationValid ? numericConcentrationVolume : undefined,
    })
  }, [
    doseReady,
    numericWeight,
    weightUnit,
    numericDose,
    doseUnit,
    basis,
    numericFrequency,
    concentrationValid,
    numericConcentration,
    concentrationUnit,
    numericConcentrationVolume,
  ])

  function changeCategory(next: Category) {
    setCategory(next)
    setFromUnit(categories[next].defaultFrom)
    setToUnit(categories[next].defaultTo)
  }

  function swapUnits() {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
  }

  function loadExample() {
    setWeight('20')
    setWeightUnit('kg')
    setDose('15')
    setDoseUnit('mg')
    setBasis('perDose')
    setFrequency('3')
    setConcentrationAmount('250')
    setConcentrationUnit('mg')
    setConcentrationVolume('5')
  }

  function clearDose() {
    setWeight('')
    setWeightUnit('kg')
    setDose('')
    setDoseUnit('mg')
    setBasis('perDose')
    setFrequency('3')
    setConcentrationAmount('')
    setConcentrationUnit('mg')
    setConcentrationVolume('')
  }

  async function handleCopy(text: string, target: Exclude<CopyTarget, null>) {
    try {
      await copyToClipboard(text)
      setCopied(target)
      window.setTimeout(() => setCopied(null), 2200)
    } catch {
      setCopied(null)
    }
  }

  const converterCopyText = converted === null ? '' : `${formatNumber(numericAmount)} ${fromUnit} = ${formatNumber(converted)} ${toUnit}`
  const doseCopyText = doseResult ? [
    'Cálculo de dosis por peso corporal',
    `Peso: ${weight} ${weightUnit} (${formatNumber(doseResult.weightKg)} kg)`,
    `Dosis indicada: ${dose} ${doseUnit}/kg ${basis === 'perDose' ? 'por toma' : 'al día'}`,
    `Tomas al día: ${frequency}`,
    `Dosis por toma: ${formatNumber(doseResult.perDoseInInputUnit)} ${doseUnit}`,
    `Dosis diaria: ${formatNumber(doseResult.totalDailyInInputUnit)} ${doseUnit}`,
    doseResult.perDoseMl !== null ? `Volumen por toma: ${formatNumber(doseResult.perDoseMl)} mL` : '',
    doseResult.totalDailyMl !== null ? `Volumen diario: ${formatNumber(doseResult.totalDailyMl)} mL` : '',
    'Verificar contra la prescripción y la presentación antes de administrar.',
  ].filter(Boolean).join('\n') : ''

  return (
    <div className="app-shell">
      <div className="ambient ambient-crimson" aria-hidden="true" />
      <div className="ambient ambient-violet" aria-hidden="true" />
      <div className="stars" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
      </div>

      <header className="site-header">
        <div className="brand" aria-label="Manrique Pharma">
          <img className="brand-mark" src="/manrique-pharma-logo.png" alt="" width="44" height="44" />
          <div>
            <span>MANRIQUE</span>
            <small>PHARMA</small>
          </div>
        </div>
        <div className="header-note"><span /> Herramienta de verificación</div>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">CÁLCULO FARMACÉUTICO · MANRIQUE PHARMA</p>
          <h1 id="page-title">Conversor de unidades<br /><em>&amp; dosis por peso</em></h1>
          <p className="hero-copy">Convierte, calcula y comprueba cada paso. Una herramienta precisa para estudiar, verificar y trabajar con claridad.</p>
        </section>

        <section className="tool-shell" aria-label="Herramientas de cálculo">
          <div className="tool-tabs" aria-label="Selecciona una herramienta">
            <button
              type="button"
              className={activeTool === 'converter' ? 'tool-tab active' : 'tool-tab'}
              aria-pressed={activeTool === 'converter'}
              onClick={() => setActiveTool('converter')}
            >
              <ArrowLeftRight size={18} /> Conversor de unidades
            </button>
            <button
              type="button"
              className={activeTool === 'dose' ? 'tool-tab active' : 'tool-tab'}
              aria-pressed={activeTool === 'dose'}
              onClick={() => setActiveTool('dose')}
            >
              <Calculator size={18} /> Dosis por peso corporal
            </button>
          </div>

          {activeTool === 'converter' ? (
            <div className="workspace converter-workspace">
              <div className="form-area">
                <div className="section-heading">
                  <div>
                    <p className="step-label">01 · CONVERSOR</p>
                    <h2>¿Qué quieres convertir?</h2>
                  </div>
                  <Scale size={24} aria-hidden="true" />
                </div>

                <div className="category-switch" aria-label="Tipo de unidad">
                  {(Object.keys(categories) as Category[]).map((key) => (
                    <button
                      type="button"
                      key={key}
                      className={category === key ? 'category-button active' : 'category-button'}
                      aria-pressed={category === key}
                      onClick={() => changeCategory(key)}
                    >
                      {categories[key].label}
                    </button>
                  ))}
                </div>

                <div className="field-group">
                  <label htmlFor="convert-amount">Valor</label>
                  <input
                    id="convert-amount"
                    className={inputClass}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Escribe un valor"
                    aria-describedby="conversion-error"
                  />
                </div>

                <div className="conversion-row">
                  <div className="field-group">
                    <label htmlFor="from-unit">De</label>
                    <select id="from-unit" className={selectClass} value={fromUnit} onChange={(event) => setFromUnit(event.target.value)}>
                      {Object.keys(categories[category].units).map((unit) => <option key={unit}>{unit}</option>)}
                    </select>
                  </div>
                  <button type="button" className="swap-button" onClick={swapUnits} aria-label="Intercambiar unidades" title="Intercambiar unidades">
                    <ArrowLeftRight size={20} />
                  </button>
                  <div className="field-group">
                    <label htmlFor="to-unit">A</label>
                    <select id="to-unit" className={selectClass} value={toUnit} onChange={(event) => setToUnit(event.target.value)}>
                      {Object.keys(categories[category].units).map((unit) => <option key={unit}>{unit}</option>)}
                    </select>
                  </div>
                </div>
                <div id="conversion-error" className="field-message" aria-live="polite">
                  {amount.trim() !== '' && converted === null ? <span className="error-text"><AlertCircle size={15} /> Escribe un número válido.</span> : 'Puedes usar coma o punto decimal.'}
                </div>
              </div>

              <aside className="result-area" aria-label="Resultado de la conversión">
                <p className="step-label">RESULTADO</p>
                {converted !== null ? (
                  <>
                    <div className="conversion-result">
                      <span>{formatNumber(numericAmount)} {fromUnit}</span>
                      <strong>{formatNumber(converted)} <small>{toUnit}</small></strong>
                    </div>
                    <p className="equivalence">Equivalencia: 1 {fromUnit} = {formatNumber(convertUnit(1, fromUnit, toUnit, categories[category].units), 8)} {toUnit}</p>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => handleCopy(converterCopyText, 'converter')}
                    >
                      {copied === 'converter' ? <Check size={18} /> : <Copy size={18} />}
                      {copied === 'converter' ? 'Copiado' : 'Copiar resultado'}
                    </button>
                  </>
                ) : (
                  <div className="empty-result">
                    <ArrowLeftRight size={28} />
                    <p>Escribe un valor para ver su equivalencia.</p>
                  </div>
                )}
              </aside>
            </div>
          ) : (
            <div className="workspace dose-workspace">
              <div className="form-area">
                <div className="section-heading">
                  <div>
                    <p className="step-label">02 · DOSIS POR PESO</p>
                    <h2>Datos de la prescripción</h2>
                  </div>
                  <button type="button" className="text-button" onClick={loadExample}><Sparkles size={16} /> Cargar ejemplo</button>
                </div>

                <div className="two-fields">
                  <div className="field-group">
                    <label htmlFor="patient-weight">Peso corporal</label>
                    <div className="input-with-unit">
                      <input
                        id="patient-weight"
                        className={inputClass}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={weight}
                        onChange={(event) => setWeight(event.target.value)}
                        placeholder="Ej. 20"
                        aria-invalid={weightInvalid}
                      />
                      <select aria-label="Unidad del peso corporal" value={weightUnit} onChange={(event) => setWeightUnit(event.target.value as WeightUnit)}>
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>
                    </div>
                    {weightInvalid && <span className="error-text"><AlertCircle size={15} /> Ingresa un peso mayor que cero.</span>}
                  </div>

                  <div className="field-group">
                    <label htmlFor="dose-amount">Dosis indicada por kg</label>
                    <div className="input-with-unit dose-unit-input">
                      <input
                        id="dose-amount"
                        className={inputClass}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={dose}
                        onChange={(event) => setDose(event.target.value)}
                        placeholder="Ej. 15"
                        aria-invalid={doseInvalid}
                      />
                      <select aria-label="Unidad de la dosis por kilogramo" value={doseUnit} onChange={(event) => setDoseUnit(event.target.value as MassUnit)}>
                        <option value="mcg">mcg/kg</option>
                        <option value="mg">mg/kg</option>
                        <option value="g">g/kg</option>
                      </select>
                    </div>
                    {doseInvalid && <span className="error-text"><AlertCircle size={15} /> Ingresa una dosis mayor que cero.</span>}
                  </div>
                </div>

                <fieldset className="basis-fieldset">
                  <legend>La dosis indicada corresponde a</legend>
                  <div className="segmented-control">
                    <button type="button" className={basis === 'perDose' ? 'active' : ''} aria-pressed={basis === 'perDose'} onClick={() => setBasis('perDose')}>Cada toma</button>
                    <button type="button" className={basis === 'perDay' ? 'active' : ''} aria-pressed={basis === 'perDay'} onClick={() => setBasis('perDay')}>El total diario</button>
                  </div>
                </fieldset>

                <div className="field-group frequency-field">
                  <label htmlFor="frequency">Número de tomas al día</label>
                  <select id="frequency" className={selectClass} value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                    <option value="1">1 toma · cada 24 horas</option>
                    <option value="2">2 tomas · cada 12 horas</option>
                    <option value="3">3 tomas · cada 8 horas</option>
                    <option value="4">4 tomas · cada 6 horas</option>
                    <option value="6">6 tomas · cada 4 horas</option>
                    <option value="8">8 tomas · cada 3 horas</option>
                    <option value="12">12 tomas · cada 2 horas</option>
                  </select>
                </div>

                <div className="concentration-section">
                  <div className="subsection-title">
                    <h3>Presentación del medicamento <span>opcional</span></h3>
                    <p>Para calcular el volumen a administrar.</p>
                  </div>
                  <label htmlFor="concentration-amount">Contenido de principio activo</label>
                  <div className="concentration-row">
                    <div className="input-with-unit">
                      <input
                        id="concentration-amount"
                        className={inputClass}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={concentrationAmount}
                        onChange={(event) => setConcentrationAmount(event.target.value)}
                        placeholder="Ej. 250"
                        aria-invalid={concentrationInvalid}
                      />
                      <select aria-label="Unidad del contenido de principio activo" value={concentrationUnit} onChange={(event) => setConcentrationUnit(event.target.value as MassUnit)}>
                        <option value="mcg">mcg</option>
                        <option value="mg">mg</option>
                        <option value="g">g</option>
                      </select>
                    </div>
                    <span className="concentration-divider">en</span>
                    <div className="input-with-unit volume-input">
                      <input
                        aria-label="Volumen de la presentación"
                        className={inputClass}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={concentrationVolume}
                        onChange={(event) => setConcentrationVolume(event.target.value)}
                        placeholder="Ej. 5"
                        aria-invalid={concentrationInvalid}
                      />
                      <span>mL</span>
                    </div>
                  </div>
                  {concentrationInvalid && <span className="error-text"><AlertCircle size={15} /> Completa contenido y volumen con valores mayores que cero.</span>}
                </div>

                <button type="button" className="clear-button" onClick={clearDose}><RotateCcw size={16} /> Limpiar datos</button>
              </div>

              <aside className="result-area dose-result-area" aria-label="Resultado de la dosis" aria-live="polite">
                <p className="step-label">RESULTADO CALCULADO</p>
                {doseResult ? (
                  <>
                    <div className="primary-dose-result">
                      <span>Dosis por toma</span>
                      <strong>{formatNumber(doseResult.perDoseInInputUnit)} <small>{doseUnit}</small></strong>
                    </div>
                    <div className="result-line">
                      <span>Dosis total diaria</span>
                      <strong>{formatNumber(doseResult.totalDailyInInputUnit)} {doseUnit}</strong>
                    </div>
                    {doseResult.perDoseMl !== null && doseResult.totalDailyMl !== null && (
                      <div className="volume-results">
                        <div className="result-line">
                          <span>Volumen por toma</span>
                          <strong>{formatNumber(doseResult.perDoseMl)} mL</strong>
                        </div>
                        <div className="result-line">
                          <span>Volumen total diario</span>
                          <strong>{formatNumber(doseResult.totalDailyMl)} mL</strong>
                        </div>
                      </div>
                    )}
                    {weightUnit === 'lb' && <p className="weight-check">Peso convertido: {formatNumber(doseResult.weightKg)} kg</p>}

                    <details className="formula-details">
                      <summary>Ver fórmula y sustitución</summary>
                      <div>
                        <p><b>1.</b> Dosis por toma = {basis === 'perDose' ? `${dose} ${doseUnit}/kg × ${formatNumber(doseResult.weightKg)} kg` : `${formatNumber(doseResult.totalDailyInInputUnit)} ${doseUnit} ÷ ${frequency} tomas`}</p>
                        <p className="formula-answer">= {formatNumber(doseResult.perDoseInInputUnit)} {doseUnit}</p>
                        <p><b>2.</b> Dosis diaria = {basis === 'perDose' ? `${formatNumber(doseResult.perDoseInInputUnit)} ${doseUnit} × ${frequency} tomas` : `${dose} ${doseUnit}/kg × ${formatNumber(doseResult.weightKg)} kg`}</p>
                        <p className="formula-answer">= {formatNumber(doseResult.totalDailyInInputUnit)} {doseUnit}</p>
                        {doseResult.perDoseMl !== null && (
                          <>
                            <p><b>3.</b> Volumen = ({formatNumber(doseResult.perDoseMg)} mg × {concentrationVolume} mL) ÷ {formatNumber(numericConcentration * MASS_TO_MG[concentrationUnit])} mg</p>
                            <p className="formula-answer">= {formatNumber(doseResult.perDoseMl)} mL por toma</p>
                          </>
                        )}
                      </div>
                    </details>

                    <button type="button" className="primary-button" onClick={() => handleCopy(doseCopyText, 'dose')}>
                      {copied === 'dose' ? <Check size={18} /> : <Copy size={18} />}
                      {copied === 'dose' ? 'Cálculo copiado' : 'Copiar cálculo'}
                    </button>
                    <p className="verification-note"><AlertCircle size={16} /> Verifica prescripción, concentración y dosis máxima según el medicamento antes de administrar.</p>
                  </>
                ) : (
                  <div className="empty-result dose-empty">
                    <Calculator size={30} />
                    <h3>Tu resultado aparecerá aquí</h3>
                    <p>Ingresa el peso corporal y la dosis indicada por kilogramo.</p>
                    <button type="button" className="secondary-button" onClick={loadExample}>Probar con un ejemplo</button>
                  </div>
                )}
              </aside>
            </div>
          )}
        </section>

        <section className="safety-strip" aria-label="Nota de uso responsable">
          <AlertCircle size={20} />
          <p><strong>Úsala como apoyo de cálculo, no como prescripción.</strong> Esta herramienta no recomienda medicamentos ni dosis. Contrasta siempre el resultado con la fórmula médica, la presentación y los protocolos aplicables.</p>
        </section>
      </main>

      <footer>
        <span>MANRIQUE PHARMA · CÁLCULO CLARO, PASO A PASO</span>
        <span>Sitio creado por Mon</span>
      </footer>
      <div className="sr-only" aria-live="polite">{copied ? 'Texto copiado al portapapeles' : ''}</div>
    </div>
  )
}
