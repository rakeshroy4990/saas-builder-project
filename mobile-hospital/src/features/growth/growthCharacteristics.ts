export type GrowthCharacteristics = {
  phrase: string;
  labels: string[];
  traitCodes: string[];
};

const ADJECTIVE_TRAITS = new Set(['LEAN', 'STOCKY', 'SLENDER', 'TALL', 'SHORT', 'LARGE_HEAD']);

function traitLabelKey(code: string): string {
  return `growth.characteristic.${code.toLowerCase()}`;
}

export function deriveGrowthTraitCodes(record: {
  weightPercentile?: number | null;
  heightPercentile?: number | null;
  bmiPercentile?: number | null;
  hcPercentile?: number | null;
}): string[] {
  const codes: string[] = [];
  const wp = record.weightPercentile;
  const hp = record.heightPercentile;
  const bp = record.bmiPercentile;
  const hcp = record.hcPercentile;

  if (bp != null && bp < 15 && (hp == null || hp >= 50)) codes.push('LEAN');
  else if (bp != null && bp > 85) codes.push('STOCKY');
  else if (wp != null && wp < 15) codes.push('SLENDER');

  if (hp != null && hp >= 85) codes.push('TALL');
  else if (hp != null && hp <= 15) codes.push('SHORT');

  if (wp != null) {
    if (wp >= 15 && wp <= 85) codes.push('NORMAL_WEIGHT');
    else if (wp < 15) codes.push('UNDERWEIGHT');
    else codes.push('OVERWEIGHT');
  }
  if (hcp != null && hcp >= 85) codes.push('LARGE_HEAD');
  if (!codes.some((code) => ADJECTIVE_TRAITS.has(code)) && !codes.length) codes.push('NORMAL_WEIGHT');

  return [...new Set(codes)];
}

function resolveSexLabel(sex: string | null | undefined, label: (key: string) => string): string {
  const sexNorm = String(sex ?? '').trim().toLowerCase();
  if (sexNorm === 'female') return label('growth.characteristic.girl');
  if (sexNorm === 'male') return label('growth.characteristic.boy');
  return label('growth.characteristic.child');
}

export function buildGrowthProfilePhrase(
  traitCodes: string[],
  sex: string | null | undefined,
  label: (key: string) => string
): string {
  const sexLabel = resolveSexLabel(sex, label);
  const adjectives = traitCodes
    .filter((code) => ADJECTIVE_TRAITS.has(code))
    .map((code) => label(traitLabelKey(code)).toLowerCase());

  if (adjectives.length) {
    let phrase = adjectives[0].charAt(0).toUpperCase() + adjectives[0].slice(1);
    if (adjectives.length > 1) phrase += ` ${adjectives.slice(1).join(' ')}`;
    return `${phrase} ${sexLabel.toLowerCase()}`.trim();
  }
  return sexLabel.trim();
}

function buildGrowthLabels(
  traitCodes: string[],
  sex: string | null | undefined,
  label: (key: string) => string
): string[] {
  const labels = traitCodes.map((code) => label(traitLabelKey(code)));
  const sexLabel = resolveSexLabel(sex, label);
  if (sexLabel && !labels.includes(sexLabel)) labels.push(sexLabel);
  return labels;
}

export function deriveGrowthCharacteristics(
  sex: string | null | undefined,
  record: {
    weightPercentile?: number | null;
    heightPercentile?: number | null;
    bmiPercentile?: number | null;
    hcPercentile?: number | null;
  },
  label: (key: string) => string
): GrowthCharacteristics {
  const traitCodes = deriveGrowthTraitCodes(record);
  return {
    phrase: buildGrowthProfilePhrase(traitCodes, sex, label),
    labels: buildGrowthLabels(traitCodes, sex, label),
    traitCodes
  };
}

export function resolveGrowthCharacteristics(
  sex: string | null | undefined,
  record: {
    weightPercentile?: number | null;
    heightPercentile?: number | null;
    bmiPercentile?: number | null;
    hcPercentile?: number | null;
  },
  label: (key: string) => string,
  fromApi?: GrowthCharacteristics | null
): GrowthCharacteristics {
  if (fromApi?.traitCodes?.length) {
    return {
      traitCodes: fromApi.traitCodes,
      labels: buildGrowthLabels(fromApi.traitCodes, sex, label),
      phrase: buildGrowthProfilePhrase(fromApi.traitCodes, sex, label)
    };
  }
  if (fromApi?.phrase) return fromApi;
  return deriveGrowthCharacteristics(sex, record, label);
}

export function parseGrowthCharacteristics(raw: unknown): GrowthCharacteristics | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const phrase = String(row.Phrase ?? row.phrase ?? '').trim();
  const labelsRaw = row.Labels ?? row.labels;
  const codesRaw = row.TraitCodes ?? row.traitCodes;
  const labels = Array.isArray(labelsRaw) ? labelsRaw.map((v) => String(v)) : [];
  const traitCodes = Array.isArray(codesRaw) ? codesRaw.map((v) => String(v)) : [];
  if (!phrase && !labels.length && !traitCodes.length) return null;
  return { phrase, labels, traitCodes };
}
