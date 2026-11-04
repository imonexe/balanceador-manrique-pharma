export type MassUnit = 'mcg' | 'mg' | 'g'
export type WeightUnit = 'kg' | 'lb'
export type DoseBasis = 'perDose' | 'perDay'

export const MASS_TO_MG: Record<MassUnit, number> = {
  mcg: 0.001,
  mg: 1,
  g: 1000,
}

export const WEIGHT_TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  lb: 0.45359237,
}

export function parseNumericInput(value: string): number {
  if (!value.trim()) return Number.NaN
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  return Number(normalized)
}

export function convertUnit(
  value: number,
  from: string,
  to: string,
  factors: Record<string, number>,
): number {
  return (value * factors[from]) / factors[to]
}

interface DoseInput {
  weight: number
  weightUnit: WeightUnit
  dose: number
  doseUnit: MassUnit
  basis: DoseBasis
  frequency: number
  concentrationAmount?: number
  concentrationUnit?: MassUnit
  concentrationVolume?: number
}

export function calculateDose({
  weight,
  weightUnit,
  dose,
  doseUnit,
  basis,
  frequency,
  concentrationAmount,
  concentrationUnit = 'mg',
  concentrationVolume,
}: DoseInput) {
  const weightKg = weight * WEIGHT_TO_KG[weightUnit]
  const prescribedMg = dose * MASS_TO_MG[doseUnit]
  const totalDailyMg = basis === 'perDay'
    ? prescribedMg * weightKg
    : prescribedMg * weightKg * frequency
  const perDoseMg = basis === 'perDay'
    ? totalDailyMg / frequency
    : prescribedMg * weightKg

  const result = {
    weightKg,
    perDoseMg,
    totalDailyMg,
    perDoseInInputUnit: perDoseMg / MASS_TO_MG[doseUnit],
    totalDailyInInputUnit: totalDailyMg / MASS_TO_MG[doseUnit],
    perDoseMl: null as number | null,
    totalDailyMl: null as number | null,
    concentrationMgPerMl: null as number | null,
  }

  if (
    concentrationAmount !== undefined &&
    concentrationVolume !== undefined &&
    Number.isFinite(concentrationAmount) &&
    Number.isFinite(concentrationVolume) &&
    concentrationAmount > 0 &&
    concentrationVolume > 0
  ) {
    const concentrationMg = concentrationAmount * MASS_TO_MG[concentrationUnit]
    result.concentrationMgPerMl = concentrationMg / concentrationVolume
    result.perDoseMl = perDoseMg / result.concentrationMgPerMl
    result.totalDailyMl = totalDailyMg / result.concentrationMgPerMl
  }

  return result
}

export function formatNumber(value: number, maximumFractionDigits = 4): string {
  if (!Number.isFinite(value)) return '—'
  const absolute = Math.abs(value)
  if (absolute > 0 && (absolute < 0.000001 || absolute >= 1_000_000_000)) {
    return value.toExponential(5).replace('.', ',')
  }
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits,
    useGrouping: true,
  }).format(value)
}
