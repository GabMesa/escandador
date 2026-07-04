const STRONG_VOWELS = new Set(['a', 'e', 'o', 'á', 'é', 'ó']);
const WEAK_VOWELS = new Set(['i', 'u', 'ü', 'í', 'ú']);
const ACCENTED_VOWELS = new Set(['á', 'é', 'í', 'ó', 'ú']);
const ALLOWED_ONSET_CLUSTERS = new Set([
  'bl',
  'br',
  'cl',
  'cr',
  'dr',
  'fl',
  'fr',
  'gl',
  'gr',
  'pl',
  'pr',
  'tr',
  'tl'
]);

const UNSTRESSED_MONOSYLLABLES = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'a',
  'en',
  'con',
  'sin',
  'por',
  'para',
  'y',
  'e',
  'o',
  'u',
  'que',
  'se',
  'me',
  'te',
  'nos',
  'os',
  'mi',
  'tu',
  'su',
  'lo',
  'le',
  'les'
]);

function isLetter(ch) {
  return /[a-záéíóúüñ]/i.test(ch);
}

function isVowelLike(ch, index, word) {
  const lower = ch.toLowerCase();

  if ('aeiouáéíóúü'.includes(lower)) {
    if (lower === 'u' && isSilentU(word, index)) {
      return false;
    }
    return true;
  }

  if (lower === 'y') {
    return index === word.length - 1;
  }

  return false;
}

function isSilentU(word, index) {
  const current = word[index]?.toLowerCase();
  if (current !== 'u') {
    return false;
  }

  const previous = word[index - 1]?.toLowerCase();
  const next = word[index + 1]?.toLowerCase();
  return (previous === 'g' || previous === 'q') && (next === 'e' || next === 'i');
}

function hasWrittenAccent(ch) {
  return ACCENTED_VOWELS.has(ch.toLowerCase());
}

function isStrong(ch) {
  return STRONG_VOWELS.has(ch.toLowerCase());
}

function isWeak(ch) {
  return WEAK_VOWELS.has(ch.toLowerCase()) || ch.toLowerCase() === 'y';
}

function isAccentedWeak(ch) {
  return ['í', 'ú'].includes(ch.toLowerCase());
}

function sanitizeWord(word) {
  return word
    .normalize('NFC')
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
    .toLowerCase();
}

function sanitizeWordPreserveCase(word) {
  return String(word ?? '')
    .normalize('NFC')
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

function mapSyllablesToOriginalCase(inputWord, normalizedSyllables) {
  const source = sanitizeWordPreserveCase(inputWord);
  if (!source || !normalizedSyllables.length) {
    return normalizedSyllables;
  }

  const mapped = [];
  let cursor = 0;

  for (const syllable of normalizedSyllables) {
    const size = syllable.length;
    mapped.push(source.slice(cursor, cursor + size));
    cursor += size;
  }

  return mapped;
}

function isWordToken(token) {
  return /[\p{L}]/u.test(token);
}

function tokenizeConsonantUnits(text, nextVowelChar) {
  const units = [];

  for (let index = 0; index < text.length; ) {
    const pair = text.slice(index, index + 2).toLowerCase();

    if (pair === 'ch' || pair === 'll' || pair === 'rr') {
      units.push({ text: text.slice(index, index + 2), rawLength: 2 });
      index += 2;
      continue;
    }

    if ((pair === 'qu' || pair === 'gu') && (nextVowelChar === 'e' || nextVowelChar === 'i')) {
      units.push({ text: text.slice(index, index + 2), rawLength: 2 });
      index += 2;
      continue;
    }

    units.push({ text: text[index], rawLength: 1 });
    index += 1;
  }

  return units;
}

function longestOnsetSuffixLength(text, nextVowelChar) {
  const units = tokenizeConsonantUnits(text, nextVowelChar);
  if (units.length === 0) {
    return 0;
  }

  if (units.length >= 2) {
    const lastTwo = units.slice(-2).map((unit) => unit.text.toLowerCase()).join('');
    if (ALLOWED_ONSET_CLUSTERS.has(lastTwo)) {
      return units.slice(-2).reduce((total, unit) => total + unit.rawLength, 0);
    }
  }

  return units[units.length - 1].rawLength;
}

function getVowelPositions(word) {
  const positions = [];

  for (let index = 0; index < word.length; index += 1) {
    if (isVowelLike(word[index], index, word)) {
      positions.push(index);
    }
  }

  return positions;
}

function canFormDiphthong(word, firstIndex, secondIndex) {
  const first = word[firstIndex];
  const second = word[secondIndex];

  for (let index = firstIndex + 1; index < secondIndex; index += 1) {
    if (word[index].toLowerCase() !== 'h') {
      return false;
    }
  }

  if (isAccentedWeak(first) || isAccentedWeak(second)) {
    return false;
  }

  if (isStrong(first) && isStrong(second)) {
    return false;
  }

  return isWeak(first) || isWeak(second);
}

function canFormTriphthong(word, firstIndex, secondIndex, thirdIndex) {
  const first = word[firstIndex];
  const second = word[secondIndex];
  const third = word[thirdIndex];

  for (let index = firstIndex + 1; index < secondIndex; index += 1) {
    if (word[index].toLowerCase() !== 'h') {
      return false;
    }
  }

  for (let index = secondIndex + 1; index < thirdIndex; index += 1) {
    if (word[index].toLowerCase() !== 'h') {
      return false;
    }
  }

  return isWeak(first) && isStrong(second) && isWeak(third) && !isAccentedWeak(first) && !isAccentedWeak(third);
}

function buildVowelGroups(word) {
  const positions = getVowelPositions(word);
  const groups = [];

  for (let index = 0; index < positions.length; ) {
    const first = positions[index];

    if (
      index + 2 < positions.length &&
      canFormTriphthong(word, positions[index], positions[index + 1], positions[index + 2])
    ) {
      groups.push({ start: first, end: positions[index + 2] });
      index += 3;
      continue;
    }

    if (index + 1 < positions.length && canFormDiphthong(word, positions[index], positions[index + 1])) {
      groups.push({ start: first, end: positions[index + 1] });
      index += 2;
      continue;
    }

    groups.push({ start: first, end: first });
    index += 1;
  }

  return groups;
}

export function normalizeInput(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').trimEnd();
}

export function splitIntoLines(text) {
  const normalized = normalizeInput(text);
  if (!normalized) {
    return [];
  }

  return normalized.split('\n');
}

export function splitLineIntoWords(line) {
  return getLineWordMatches(line).map((item) => item.word).filter(isWordToken);
}

export function getLineWordMatches(line) {
  const pattern = /[\p{L}]+(?:['’\-][\p{L}]+)*/gu;
  const matches = [];

  for (const match of String(line ?? '').matchAll(pattern)) {
    const word = match[0];
    const start = match.index ?? 0;
    matches.push({
      word,
      start,
      end: start + word.length
    });
  }

  return matches;
}

export function syllabifyWord(inputWord) {
  const word = sanitizeWord(inputWord);
  if (!word) {
    return [];
  }

  const vowelGroups = buildVowelGroups(word);
  if (vowelGroups.length === 0) {
    return [word];
  }

  const syllables = [];
  let currentStart = 0;

  for (let index = 0; index < vowelGroups.length; index += 1) {
    const group = vowelGroups[index];
    const nextGroup = vowelGroups[index + 1];

    if (!nextGroup) {
      syllables.push(word.slice(currentStart));
      break;
    }

    const gap = word.slice(group.end + 1, nextGroup.start);
    const onsetLength = longestOnsetSuffixLength(gap, word[nextGroup.start]);
    const boundary = nextGroup.start - onsetLength;

    syllables.push(word.slice(currentStart, boundary));
    currentStart = boundary;
  }

  return syllables.filter(Boolean);
}

function findAccentedVowelIndex(word) {
  for (let index = 0; index < word.length; index += 1) {
    if (hasWrittenAccent(word[index])) {
      return index;
    }
  }

  return -1;
}

export function detectStressSyllable(word, syllables) {
  const normalized = sanitizeWord(word);
  if (!normalized || syllables.length === 0) {
    return 0;
  }

  const accentIndex = findAccentedVowelIndex(normalized);
  if (accentIndex !== -1) {
    let cursor = 0;
    for (let index = 0; index < syllables.length; index += 1) {
      const syllable = syllables[index];
      const end = cursor + syllable.length;
      if (accentIndex >= cursor && accentIndex < end) {
        return index;
      }
      cursor = end;
    }
  }

  if (syllables.length === 1) {
    return 0;
  }

  const ending = normalized.slice(-1);
  const shouldStressPenultimate = ['a', 'e', 'i', 'o', 'u', 'n', 's'].includes(ending);
  return shouldStressPenultimate ? Math.max(0, syllables.length - 2) : syllables.length - 1;
}

export function classifyWordAccentType(syllables, stressIndex) {
  if (syllables.length <= 1) {
    return 'monosílaba';
  }

  const positionFromEnd = syllables.length - 1 - stressIndex;
  if (positionFromEnd === 0) {
    return 'aguda';
  }
  if (positionFromEnd === 1) {
    return 'llana';
  }
  if (positionFromEnd === 2) {
    return 'esdrújula';
  }
  return 'sobreesdrújula';
}

export function analyzeWord(inputWord) {
  const original = String(inputWord ?? '').trim();
  const normalized = sanitizeWord(original);
  const syllables = mapSyllablesToOriginalCase(original, syllabifyWord(original));
  const stressIndex = detectStressSyllable(original, syllables);
  const accentType = classifyWordAccentType(syllables, stressIndex);

  return {
    original,
    normalized,
    syllables,
    stressIndex,
    accentType,
    syllableCount: syllables.length,
    hasWrittenAccent: findAccentedVowelIndex(normalized) !== -1
  };
}

export function adjustPoeticCount(syllableCount, accentType) {
  if (accentType === 'aguda' || accentType === 'monosílaba') {
    return syllableCount + 1;
  }

  if (accentType === 'esdrújula' || accentType === 'sobreesdrújula') {
    return syllableCount - 1;
  }

  return syllableCount;
}

export function analyzeLine(line) {
  const wordMatches = getLineWordMatches(line);
  const words = wordMatches.map((item) => item.word);
  const analyses = words.map(analyzeWord);
  const rawCount = analyses.reduce((total, word) => total + word.syllableCount, 0);
  const lastWord = analyses.at(-1) ?? null;
  const accentType = lastWord?.accentType ?? 'llana';
  const poeticCount = adjustPoeticCount(rawCount, accentType);

  const separators = [];
  const boundaries = [];
  let cursor = 0;

  for (let index = 0; index < wordMatches.length - 1; index += 1) {
    const current = wordMatches[index];
    const next = wordMatches[index + 1];
    const separator = String(line ?? '').slice(current.end, next.start);
    separators.push(separator);

    const currentAnalysis = analyses[index];
    const nextAnalysis = analyses[index + 1];
    const boundaryPosition = cursor + currentAnalysis.syllableCount;

    boundaries.push({
      index,
      between: [current.word, next.word],
      separator,
      boundaryPosition,
      strongPause: /[.;:!?¡¿]/.test(separator),
      candidate: isSinalefaCandidate(currentAnalysis, nextAnalysis),
      blockedByHemistich: false
    });

    cursor += currentAnalysis.syllableCount;
  }

  return {
    text: line,
    words,
    wordMatches,
    separators,
    boundaries,
    analyses,
    rawCount,
    poeticCount,
    accentType,
    lastWord: lastWord?.original ?? ''
  };
}

export function analyzePoem(text) {
  const lines = splitIntoLines(text);
  const analyzedLines = lines.map(analyzeLine);

  return {
    lines: analyzedLines,
    rawCount: analyzedLines.reduce((total, line) => total + line.rawCount, 0),
    poeticCount: analyzedLines.reduce((total, line) => total + line.poeticCount, 0)
  };
}

function startsWithVowelSound(word) {
  if (!word) {
    return false;
  }

  const normalized = sanitizeWord(word);
  if (!normalized) {
    return false;
  }

  const first = normalized[0];
  if (first === 'h') {
    const second = normalized[1] ?? '';
    return isVowelLike(second, 1, normalized);
  }

  return isVowelLike(first, 0, normalized);
}

function endsWithVowelSound(word) {
  if (!word) {
    return false;
  }

  const normalized = sanitizeWord(word);
  if (!normalized) {
    return false;
  }

  const last = normalized.at(-1) ?? '';
  return isVowelLike(last, normalized.length - 1, normalized);
}

export function isSinalefaCandidate(leftWordAnalysis, rightWordAnalysis) {
  if (!leftWordAnalysis || !rightWordAnalysis) {
    return false;
  }

  return endsWithVowelSound(leftWordAnalysis.normalized) && startsWithVowelSound(rightWordAnalysis.normalized);
}

export function isUnstressedMonosyllable(word) {
  const normalized = sanitizeWord(word);
  return UNSTRESSED_MONOSYLLABLES.has(normalized);
}
