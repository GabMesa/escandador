import {
  analyzePoem,
  normalizeInput,
  analyzeWord,
  adjustPoeticCount,
  isUnstressedMonosyllable
} from './analyzer.js';

const poemInput = document.getElementById('poemInput');
const analysisOutput = document.getElementById('analysisOutput');
const stressPreset = document.getElementById('stressPreset');
const stressCustom = document.getElementById('stressCustom');
const hemistichSplit = document.getElementById('hemistichSplit');
const rhymeMode = document.getElementById('rhymeMode');
const rhymeScheme = document.getElementById('rhymeScheme');
const sinalefaEnabled = document.getElementById('sinalefaEnabled');
const stanzaSummaryBadge = document.getElementById('stanzaSummaryBadge');
const rhymeSchemeBadge = document.getElementById('rhymeSchemeBadge');
const poemTitle = document.getElementById('poemTitle');
const savePoem = document.getElementById('savePoem');
const loadPoem = document.getElementById('loadPoem');
const savedPoemName = document.getElementById('savedPoemName');
const savedPoemVersion = document.getElementById('savedPoemVersion');
const openVersionManager = document.getElementById('openVersionManager');
const editPoemVersionLabel = document.getElementById('editPoemVersionLabel');
const deletePoemVersion = document.getElementById('deletePoemVersion');
const deleteSelectedVersions = document.getElementById('deleteSelectedVersions');
const savedVersionsList = document.getElementById('savedVersionsList');
const versionManagerModal = document.getElementById('versionManagerModal');
const closeVersionManager = document.getElementById('closeVersionManager');
const selectAllVersions = document.getElementById('selectAllVersions');
const versionLabelInput = document.getElementById('versionLabelInput');
const applyVersionLabel = document.getElementById('applyVersionLabel');
const deletePoemEntry = document.getElementById('deletePoemEntry');
const importPoemsMd = document.getElementById('importPoemsMd');
const exportPoemsMd = document.getElementById('exportPoemsMd');
const importPoemsFile = document.getElementById('importPoemsFile');
const analysisModeToggle = document.getElementById('analysisModeToggle');
const analysisTextOutput = document.getElementById('analysisTextOutput');
const fontScaleControl = document.getElementById('fontScaleControl');
const fontScaleValue = document.getElementById('fontScaleValue');
const fontSizeDown = document.getElementById('fontSizeDown');
const fontSizeUp = document.getElementById('fontSizeUp');
const panelViewMode = document.getElementById('panelViewMode');
const workspace = document.querySelector('.workspace');
const inputPanel = document.querySelector('.input-panel');
const outputPanel = document.querySelector('.output-panel');

const SAMPLE_POEM = `Silba la ciudad durmiente
desde este séptimo piso.
Miro al cielo y no diviso
ni una estrella, como siempre.
Siento el ruido, cómo duermen
más de un millón de almas;
Sueñan pendientes de alarmas
que indican un nuevo día.
Sueñan, quizás, que la vida
es más estrellas que alarmas. `;

const DEFAULT_SEXTINA_SCHEME = 'ABCDEF FAEBDC CFDABE ECBFAD DEACFB BDFECA AB DE CF';


const LOCAL_POEM_MEMORY_KEY = 'escandador.poemMemory.v1';
const LOCAL_UI_PREFERENCES_KEY = 'escandador.uiPreferences.v1';
const AUTO_SAVE_DELAY_MS = 1200;

const state = {
  stressPattern: [],
  hemistichEnabled: false,
  hemistichPositions: [],
  rhymeMode: 'asonante',
  rhymeScheme: '',
  analysisMode: 'visual',
  panelViewMode: 'both',
  fontScale: 100,
  sinalefaEnabled: true,
  conservativeSinalefa: true,
  loadedVersionId: '',
  loadedVersionTitle: '',
  sinalefaOverrides: {},
  lineOverrides: {},
  openAdvancedByLine: {}
};

let lastRuntime = [];
let autoSaveTimer = null;
let toastTimer = null;
let selectedVersionIds = new Set();

function ensureToastElement() {
  let toast = document.getElementById('appToast');
  if (toast) {
    return toast;
  }

  toast = document.createElement('div');
  toast.id = 'appToast';
  toast.className = 'app-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  return toast;
}

function showToast(message, type = 'info') {
  const toast = ensureToastElement();
  toast.textContent = String(message ?? '').trim();
  toast.classList.remove('is-info', 'is-success', 'is-warning', 'is-error');
  toast.classList.add(`is-${type}`);
  toast.classList.add('is-visible');

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

function clampFontScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 100;
  }

  return Math.max(5, Math.round(numeric / 5) * 5);
}

function loadUiPreferences() {
  try {
    const raw = localStorage.getItem(LOCAL_UI_PREFERENCES_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function saveUiPreferences() {
  try {
    localStorage.setItem(
      LOCAL_UI_PREFERENCES_KEY,
      JSON.stringify({
        fontScale: state.fontScale,
        panelViewMode: state.panelViewMode
      })
    );
  } catch {
    // Ignore storage errors to avoid blocking analysis.
  }
}

function applyFontScale() {
  const scale = clampFontScale(state.fontScale);
  state.fontScale = scale;
  document.documentElement.style.setProperty('--user-font-scale', String(scale / 100));

  if (fontScaleControl) {
    fontScaleControl.value = String(scale);
  }

  if (fontScaleValue) {
    fontScaleValue.textContent = `${scale}%`;
  }
}

function applyPanelViewMode() {
  const validModes = new Set(['both', 'writing', 'analysis']);
  if (!validModes.has(state.panelViewMode)) {
    state.panelViewMode = 'both';
  }

  const writingOnly = state.panelViewMode === 'writing';
  const analysisOnly = state.panelViewMode === 'analysis';

  if (workspace) {
    workspace.classList.toggle('view-writing-only', writingOnly);
    workspace.classList.toggle('view-analysis-only', analysisOnly);
  }

  if (inputPanel) {
    inputPanel.classList.toggle('hidden', analysisOnly);
  }

  if (outputPanel) {
    outputPanel.classList.toggle('hidden', writingOnly);
  }

  if (panelViewMode) {
    panelViewMode.value = state.panelViewMode;
  }
}

function adjustFontScale(step) {
  state.fontScale = clampFontScale(state.fontScale + step);
  applyFontScale();
  saveUiPreferences();
}

function initializeUiPreferences() {
  const preferences = loadUiPreferences();
  state.fontScale = clampFontScale(preferences.fontScale ?? state.fontScale);

  const preferredPanelMode = String(preferences.panelViewMode ?? '').trim();
  if (preferredPanelMode === 'writing' || preferredPanelMode === 'analysis' || preferredPanelMode === 'both') {
    state.panelViewMode = preferredPanelMode;
  }

  applyFontScale();
  applyPanelViewMode();
}

function normalizePoemTitle(value) {
  const title = String(value ?? '').trim();
  return title || 'Sin título';
}

function setPoemTitleDisplay(value) {
  if (!poemTitle) {
    return;
  }
  poemTitle.value = normalizePoemTitle(value);
}

function loadPoemMemoryStore() {
  try {
    const raw = localStorage.getItem(LOCAL_POEM_MEMORY_KEY);
    if (!raw) {
      return { poems: {} };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.poems !== 'object') {
      return { poems: {} };
    }

    return parsed;
  } catch {
    return { poems: {} };
  }
}

function savePoemMemoryStore(store) {
  try {
    localStorage.setItem(LOCAL_POEM_MEMORY_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

function formatVersionTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'fecha desconocida';
  }
  return date.toLocaleString('es-ES');
}

function normalizeVersionLabel(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);
}

function ensureVersionMetadata(versions) {
  if (!Array.isArray(versions) || !versions.length) {
    return false;
  }

  let changed = false;
  let maxVersionNumber = 0;

  for (const entry of versions) {
    const number = Number(entry?.versionNumber);
    if (Number.isInteger(number) && number > 0) {
      maxVersionNumber = Math.max(maxVersionNumber, number);
    }
  }

  const rankedByAge = [...versions].sort((a, b) => {
    const left = new Date(a?.savedAt ?? 0).getTime();
    const right = new Date(b?.savedAt ?? 0).getTime();
    return left - right;
  });

  for (const entry of rankedByAge) {
    const number = Number(entry?.versionNumber);
    if (Number.isInteger(number) && number > 0) {
      continue;
    }

    maxVersionNumber += 1;
    entry.versionNumber = maxVersionNumber;
    changed = true;
  }

  return changed;
}

function getNextVersionNumber(versions) {
  let maxVersionNumber = 0;
  for (const entry of versions) {
    const number = Number(entry?.versionNumber);
    if (Number.isInteger(number) && number > 0) {
      maxVersionNumber = Math.max(maxVersionNumber, number);
    }
  }

  return maxVersionNumber + 1;
}

function getVersionLabel(entry, index, total) {
  const label = normalizeVersionLabel(entry?.label ?? '');
  if (label) {
    return label;
  }

  const versionNumber = Number(entry?.versionNumber);
  if (Number.isInteger(versionNumber) && versionNumber > 0) {
    return `Versión ${versionNumber}`;
  }

  return `Versión ${total - index}`;
}

function updateSelectAllButtonLabel(totalItems) {
  if (!selectAllVersions) {
    return;
  }

  const checked = selectedVersionIds.size;
  selectAllVersions.textContent = totalItems > 0 && checked >= totalItems ? 'Deseleccionar todo' : 'Seleccionar todo';
}

function syncSelectedVersionLabelInput() {
  if (!versionLabelInput) {
    return;
  }

  const selected = getSelectedPoemVersionEntry();
  versionLabelInput.value = selected ? normalizeVersionLabel(selected.version.label ?? '') : '';
}

function openVersionManagerModal({ focusLabel = false } = {}) {
  if (!versionManagerModal) {
    return;
  }

  versionManagerModal.classList.add('is-open');
  versionManagerModal.setAttribute('aria-hidden', 'false');
  renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
  syncSelectedVersionLabelInput();

  if (focusLabel && versionLabelInput) {
    versionLabelInput.focus();
    versionLabelInput.select();
  }
}

function closeVersionManagerModal() {
  if (!versionManagerModal) {
    return;
  }

  versionManagerModal.classList.remove('is-open');
  versionManagerModal.setAttribute('aria-hidden', 'true');
}

function renderSavedVersionList(title, preferredVersionId = '') {
  if (!savedVersionsList) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[title]) ? store.poems[title] : [];
  const metadataChanged = ensureVersionMetadata(versions);
  if (metadataChanged) {
    savePoemMemoryStore(store);
  }
  const ranked = [...versions].sort((a, b) => {
    const left = new Date(a.savedAt ?? 0).getTime();
    const right = new Date(b.savedAt ?? 0).getTime();
    return right - left;
  });

  savedVersionsList.innerHTML = '';
  if (!title) {
    selectedVersionIds = new Set();
    updateSelectAllButtonLabel(0);
    savedVersionsList.innerHTML = '<div class="saved-version-meta">Selecciona un poema para ver sus versiones.</div>';
    return;
  }

  if (!ranked.length) {
    selectedVersionIds = new Set();
    updateSelectAllButtonLabel(0);
    savedVersionsList.innerHTML = '<div class="saved-version-meta">No hay versiones para mostrar.</div>';
    return;
  }

  const validIds = new Set(ranked.map((entry) => String(entry.id ?? '')));
  selectedVersionIds = new Set([...selectedVersionIds].filter((id) => validIds.has(id)));

  ranked.forEach((entry, index) => {
    const item = document.createElement('label');
    item.className = 'saved-version-item';
    item.setAttribute('role', 'listitem');
    if (String(entry.id ?? '') === preferredVersionId) {
      item.classList.add('is-active');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'saved-version-checkbox';
    checkbox.value = String(entry.id ?? '');
    checkbox.checked = selectedVersionIds.has(checkbox.value);

    const text = document.createElement('span');
    text.className = 'saved-version-text';

    const main = document.createElement('span');
    main.className = 'saved-version-main';

    const label = document.createElement('span');
    label.className = 'saved-version-label';
    label.textContent = getVersionLabel(entry, index, ranked.length);

    const kind = document.createElement('span');
    kind.className = 'saved-version-kind';
    kind.textContent = entry.kind === 'autosave' ? 'Auto' : 'Manual';

    const meta = document.createElement('span');
    meta.className = 'saved-version-meta';
    meta.textContent = formatVersionTimestamp(entry.savedAt);

    main.append(label, kind);
    text.append(main, meta);
    item.append(checkbox, text);
    savedVersionsList.appendChild(item);
  });

  updateSelectAllButtonLabel(ranked.length);
}

function refreshSavedPoemVersionOptions(title, preferredVersionId = '') {
  if (!savedPoemVersion) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[title]) ? store.poems[title] : [];
  const metadataChanged = ensureVersionMetadata(versions);
  if (metadataChanged) {
    savePoemMemoryStore(store);
  }
  const ranked = [...versions].sort((a, b) => {
    const left = new Date(a.savedAt ?? 0).getTime();
    const right = new Date(b.savedAt ?? 0).getTime();
    return right - left;
  });

  savedPoemVersion.innerHTML = '';
  if (!ranked.length) {
    savedPoemVersion.innerHTML = '<option value="">Sin versiones</option>';
    savedPoemVersion.disabled = true;
    renderSavedVersionList(title, preferredVersionId);
    return;
  }

  ranked.forEach((entry, index) => {
    const option = document.createElement('option');
    option.value = String(entry.id ?? '');
    option.textContent = `${getVersionLabel(entry, index, ranked.length)} · ${formatVersionTimestamp(entry.savedAt)}`;
    savedPoemVersion.appendChild(option);
  });

  savedPoemVersion.disabled = false;
  if (preferredVersionId && ranked.some((item) => String(item.id) === preferredVersionId)) {
    savedPoemVersion.value = preferredVersionId;
  }

  renderSavedVersionList(title, preferredVersionId);
}

function refreshSavedPoemNameOptions(preferredTitle = '') {
  if (!savedPoemName) {
    return;
  }

  const store = loadPoemMemoryStore();
  const titles = Object.keys(store.poems ?? {}).sort((a, b) => a.localeCompare(b, 'es'));

  savedPoemName.innerHTML = '';
  if (!titles.length) {
    savedPoemName.innerHTML = '<option value="">Sin poemas guardados</option>';
    savedPoemName.disabled = true;
    refreshSavedPoemVersionOptions('', '');
    return;
  }

  for (const title of titles) {
    const option = document.createElement('option');
    option.value = title;
    option.textContent = title;
    savedPoemName.appendChild(option);
  }

  savedPoemName.disabled = false;
  const fallback = titles.includes(preferredTitle) ? preferredTitle : titles[0];
  savedPoemName.value = fallback;
  refreshSavedPoemVersionOptions(fallback);
}

function getSelectedSavedVersion() {
  const selectedTitle = savedPoemName?.value ?? '';
  const selectedVersionId = savedPoemVersion?.value ?? '';
  if (!selectedTitle || !selectedVersionId) {
    return null;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selectedTitle]) ? store.poems[selectedTitle] : [];
  const version = versions.find((entry) => String(entry.id ?? '') === selectedVersionId);
  if (!version) {
    return null;
  }

  return {
    title: selectedTitle,
    version
  };
}

function buildCurrentSnapshot() {
  return {
    poemText: poemInput.value,
    settings: {
      stressPreset: stressPreset.value,
      stressCustom: stressCustom.value,
      hemistichSplit: hemistichSplit.value,
      rhymeMode: rhymeMode?.value ?? 'asonante',
      rhymeScheme: rhymeScheme?.value ?? ''
    },
    sinalefaOverrides: state.sinalefaOverrides,
    lineOverrides: state.lineOverrides
  };
}

function getSnapshotSignature(snapshot) {
  return JSON.stringify({
    poemText: String(snapshot.poemText ?? ''),
    settings: {
      stressPreset: String(snapshot.settings?.stressPreset ?? ''),
      stressCustom: String(snapshot.settings?.stressCustom ?? ''),
      hemistichSplit: String(snapshot.settings?.hemistichSplit ?? ''),
      rhymeMode: String(snapshot.settings?.rhymeMode ?? 'asonante'),
      rhymeScheme: String(snapshot.settings?.rhymeScheme ?? '')
    },
    sinalefaOverrides: snapshot.sinalefaOverrides ?? {},
    lineOverrides: snapshot.lineOverrides ?? {}
  });
}

function getVersionSnapshotSignature(entry) {
  return getSnapshotSignature({
    poemText: entry?.poemText,
    settings: entry?.settings,
    sinalefaOverrides: entry?.sinalefaOverrides,
    lineOverrides: entry?.lineOverrides
  });
}

function isCurrentDraftDirtyAgainstLoadedVersion() {
  const loadedTitle = String(state.loadedVersionTitle ?? '').trim();
  const loadedVersionId = String(state.loadedVersionId ?? '').trim();
  if (!loadedTitle || !loadedVersionId) {
    return false;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[loadedTitle]) ? store.poems[loadedTitle] : [];
  const loadedEntry = versions.find((entry) => String(entry.id ?? '') === loadedVersionId);
  if (!loadedEntry) {
    return false;
  }

  const loadedSignature = getVersionSnapshotSignature(loadedEntry);
  const currentSignature = getSnapshotSignature(buildCurrentSnapshot());
  return loadedSignature !== currentSignature;
}

function saveCurrentPoemVersion(options = {}) {
  const {
    notify = false,
    notifyWhenUnchanged = false,
    kind = 'manual'
  } = options;
  const saveKind = kind === 'autosave' ? 'autosave' : 'manual';

  const title = normalizePoemTitle(poemTitle?.value ?? '');
  if (poemTitle) {
    poemTitle.value = title;
  }
  setPoemTitleDisplay(title);

  const store = loadPoemMemoryStore();
  if (!Array.isArray(store.poems[title])) {
    store.poems[title] = [];
  }
  ensureVersionMetadata(store.poems[title]);
  const nextVersionNumber = getNextVersionNumber(store.poems[title]);

  const snapshot = buildCurrentSnapshot();
  const latest = store.poems[title].at(-1);
  const nextSignature = getSnapshotSignature(snapshot);
  const nextVersion = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    poemText: snapshot.poemText,
    settings: snapshot.settings,
    sinalefaOverrides: snapshot.sinalefaOverrides,
    lineOverrides: snapshot.lineOverrides,
    kind: saveKind,
    label: '',
    versionNumber: nextVersionNumber
  };

  if (latest) {
    const latestSignature = getSnapshotSignature({
      poemText: latest.poemText,
      settings: latest.settings,
      sinalefaOverrides: latest.sinalefaOverrides,
      lineOverrides: latest.lineOverrides
    });
    const latestKind = String(latest.kind ?? 'manual');
    const latestWasAutosave = latestKind === 'autosave';
    const shouldReplaceLatest = latestWasAutosave && (saveKind === 'autosave' || saveKind === 'manual');

    if (shouldReplaceLatest) {
      const preservedVersionNumber = Number.isInteger(Number(latest.versionNumber)) && Number(latest.versionNumber) > 0
        ? Number(latest.versionNumber)
        : nextVersionNumber;
      store.poems[title][store.poems[title].length - 1] = {
        ...latest,
        ...nextVersion,
        versionNumber: preservedVersionNumber,
        label: normalizeVersionLabel(latest.label ?? '')
      };
    } else if (latestSignature === nextSignature && latestKind === saveKind) {
      refreshSavedPoemNameOptions(title);
      refreshSavedPoemVersionOptions(title, String(latest.id ?? ''));
      if (notify && notifyWhenUnchanged) {
        showToast('Sin cambios para guardar.', 'warning');
      }
      return false;
    } else {
      store.poems[title].push(nextVersion);
    }
  } else {
    store.poems[title].push(nextVersion);
  }

  const ok = savePoemMemoryStore(store);
  if (!ok) {
    if (notify) {
      showToast('No se pudo guardar el poema.', 'error');
    }
    return false;
  }

  refreshSavedPoemNameOptions(title);
  refreshSavedPoemVersionOptions(title, nextVersion.id);
  if (notify) {
    showToast('Poema guardado.', 'success');
  }
  return true;
}

function getSelectedPoemVersionEntry() {
  const selectedTitle = savedPoemName?.value ?? '';
  const selectedVersionId = savedPoemVersion?.value ?? '';
  if (!selectedTitle || !selectedVersionId) {
    return null;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selectedTitle]) ? store.poems[selectedTitle] : [];
  const versionIndex = versions.findIndex((entry) => String(entry.id ?? '') === selectedVersionId);
  if (versionIndex < 0) {
    return null;
  }

  return {
    title: selectedTitle,
    versionIndex,
    version: versions[versionIndex]
  };
}

function updateSelectedVersionLabel() {
  const selected = getSelectedPoemVersionEntry();
  if (!selected) {
    showToast('Selecciona una versión para etiquetarla.', 'warning');
    return;
  }

  const nextLabel = normalizeVersionLabel(versionLabelInput?.value ?? selected.version.label ?? '');
  const currentLabel = normalizeVersionLabel(selected.version.label ?? '');
  if (nextLabel === currentLabel) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selected.title]) ? store.poems[selected.title] : [];
  if (!versions[selected.versionIndex]) {
    return;
  }

  versions[selected.versionIndex] = {
    ...versions[selected.versionIndex],
    label: nextLabel
  };

  if (!savePoemMemoryStore(store)) {
    showToast('No se pudo cambiar la etiqueta.', 'error');
    return;
  }

  refreshSavedPoemNameOptions(selected.title);
  refreshSavedPoemVersionOptions(selected.title, selected.version.id);
  syncSelectedVersionLabelInput();
  showToast(nextLabel ? 'Etiqueta actualizada.' : 'Etiqueta quitada.', 'success');
}

function getCheckedVersionIds() {
  return [...selectedVersionIds];
}

function deleteSelectedPoemVersions() {
  const selectedTitle = savedPoemName?.value ?? '';
  const checkedIds = getCheckedVersionIds();
  if (!selectedTitle || !checkedIds.length) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selectedTitle]) ? store.poems[selectedTitle] : [];
  const selectedCount = versions.filter((entry) => checkedIds.includes(String(entry.id ?? ''))).length;
  if (!selectedCount) {
    return;
  }

  const shouldDelete = window.confirm(`¿Eliminar ${selectedCount} versión${selectedCount === 1 ? '' : 'es'} del poema "${selectedTitle}"?`);
  if (!shouldDelete) {
    return;
  }

  const remaining = versions.filter((entry) => !checkedIds.includes(String(entry.id ?? '')));
  if (remaining.length) {
    store.poems[selectedTitle] = remaining;
  } else {
    delete store.poems[selectedTitle];
  }

  if (!savePoemMemoryStore(store)) {
    showToast('No se pudieron borrar las versiones.', 'error');
    return;
  }

  refreshSavedPoemNameOptions(selectedTitle);
  if (store.poems[selectedTitle]?.length) {
    refreshSavedPoemVersionOptions(selectedTitle);
    loadSelectedPoemVersion();
  }

  selectedVersionIds = new Set();
  renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
  syncSelectedVersionLabelInput();

  showToast(`${selectedCount} versión${selectedCount === 1 ? '' : 'es'} borrada${selectedCount === 1 ? '' : 's'}.`, 'success');
}

function scheduleAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    saveCurrentPoemVersion({ kind: 'autosave' });
  }, AUTO_SAVE_DELAY_MS);
}

function loadSelectedPoemVersion() {
  const selected = getSelectedSavedVersion();
  if (!selected) {
    return;
  }

  if (poemTitle) {
    poemTitle.value = selected.title;
  }
  setPoemTitleDisplay(selected.title);
  poemInput.value = String(selected.version.poemText ?? '');
  if (selected.version.settings) {
    stressPreset.value = String(selected.version.settings.stressPreset ?? stressPreset.value);
    stressCustom.value = String(selected.version.settings.stressCustom ?? stressCustom.value);
    hemistichSplit.value = String(selected.version.settings.hemistichSplit ?? hemistichSplit.value);
    if (rhymeMode) {
      const savedRhymeMode = String(selected.version.settings.rhymeMode ?? 'asonante');
      rhymeMode.value = savedRhymeMode === 'consonante' || savedRhymeMode === 'sextina'
        ? savedRhymeMode
        : 'asonante';
    }
    if (rhymeScheme) {
      rhymeScheme.value = String(selected.version.settings.rhymeScheme ?? rhymeScheme.value);
    }
  }

  state.sinalefaOverrides = selected.version.sinalefaOverrides && typeof selected.version.sinalefaOverrides === 'object'
    ? { ...selected.version.sinalefaOverrides }
    : {};
  state.lineOverrides = selected.version.lineOverrides && typeof selected.version.lineOverrides === 'object'
    ? { ...selected.version.lineOverrides }
    : {};
  state.loadedVersionTitle = selected.title;
  state.loadedVersionId = String(selected.version.id ?? '');
  state.openAdvancedByLine = {};
  updateAnalysis();
  refreshSavedPoemVersionOptions(selected.title, selected.version.id);
}

function deleteSelectedPoemVersion() {
  const selectedTitle = savedPoemName?.value ?? '';
  const selectedVersionId = savedPoemVersion?.value ?? '';
  if (!selectedTitle || !selectedVersionId) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selectedTitle]) ? store.poems[selectedTitle] : [];
  if (!versions.length) {
    return;
  }

  const target = versions.find((entry) => String(entry.id ?? '') === selectedVersionId);
  if (!target) {
    return;
  }

  const shouldDelete = window.confirm(`¿Eliminar la versión guardada de "${selectedTitle}" (${formatVersionTimestamp(target.savedAt)})?`);
  if (!shouldDelete) {
    return;
  }

  const remaining = versions.filter((entry) => String(entry.id ?? '') !== selectedVersionId);
  if (remaining.length) {
    store.poems[selectedTitle] = remaining;
  } else {
    delete store.poems[selectedTitle];
  }

  const ok = savePoemMemoryStore(store);
  if (!ok) {
    return;
  }

  refreshSavedPoemNameOptions(selectedTitle);
  if (store.poems[selectedTitle]?.length) {
    refreshSavedPoemVersionOptions(selectedTitle);
    loadSelectedPoemVersion();
  } else if ((savedPoemName?.value ?? '') && !savedPoemName.disabled) {
    loadSelectedPoemVersion();
  }
}

function deleteSelectedPoemEntry() {
  const selectedTitle = savedPoemName?.value ?? '';
  if (!selectedTitle) {
    return;
  }

  const shouldDelete = window.confirm(`¿Eliminar todo el historial del poema "${selectedTitle}"?`);
  if (!shouldDelete) {
    return;
  }

  const store = loadPoemMemoryStore();
  delete store.poems[selectedTitle];

  const ok = savePoemMemoryStore(store);
  if (!ok) {
    return;
  }

  refreshSavedPoemNameOptions('');
  if ((savedPoemName?.value ?? '') && !savedPoemName.disabled) {
    loadSelectedPoemVersion();
  }
}

function parsePoemsFromMarkdown(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const poems = [];
  let currentTitle = '';
  let currentLines = [];

  const flush = () => {
    if (!currentTitle) {
      return;
    }
    poems.push({
      title: normalizePoemTitle(currentTitle),
      text: currentLines.join('\n').trim()
    });
    currentLines = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#\s*(.+?)\s*$/);
    if (heading) {
      flush();
      currentTitle = heading[1];
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    }
  }

  flush();
  return poems.filter((item) => item.title && item.text.trim());
}

function importPoemsFromMarkdown(markdown) {
  const parsed = parsePoemsFromMarkdown(markdown);
  if (!parsed.length) {
    return;
  }

  const store = loadPoemMemoryStore();
  for (const entry of parsed) {
    if (!Array.isArray(store.poems[entry.title])) {
      store.poems[entry.title] = [];
    }

    ensureVersionMetadata(store.poems[entry.title]);
    const nextVersionNumber = getNextVersionNumber(store.poems[entry.title]);

    store.poems[entry.title].push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      poemText: entry.text,
      settings: {
        stressPreset: stressPreset.value,
        stressCustom: stressCustom.value,
        hemistichSplit: hemistichSplit.value,
        rhymeMode: rhymeMode?.value ?? 'asonante',
        rhymeScheme: rhymeScheme?.value ?? ''
      },
      sinalefaOverrides: {},
      lineOverrides: {},
      kind: 'manual',
      label: '',
      versionNumber: nextVersionNumber
    });
  }

  const ok = savePoemMemoryStore(store);
  if (!ok) {
    return;
  }

  const first = parsed[0];
  refreshSavedPoemNameOptions(first.title);
  if (poemTitle) {
    poemTitle.value = first.title;
  }
  setPoemTitleDisplay(first.title);
  poemInput.value = first.text;
  updateAnalysis();
}

function buildMarkdownExportFromStore() {
  const store = loadPoemMemoryStore();
  const titles = Object.keys(store.poems ?? {}).sort((a, b) => a.localeCompare(b, 'es'));
  const chunks = [];

  for (const title of titles) {
    const versions = Array.isArray(store.poems[title]) ? store.poems[title] : [];
    if (!versions.length) {
      continue;
    }

    const latest = [...versions].sort((a, b) => {
      const left = new Date(a.savedAt ?? 0).getTime();
      const right = new Date(b.savedAt ?? 0).getTime();
      return right - left;
    })[0];

    chunks.push(`#${title}`);
    chunks.push('');
    chunks.push(String(latest.poemText ?? '').trimEnd());
    chunks.push('');
  }

  return chunks.join('\n').trim() + '\n';
}

function downloadMarkdownFile() {
  const content = buildMarkdownExportFromStore();
  if (!content.trim()) {
    return;
  }

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'poemas.md';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatWordPlain(wordAnalysis) {
  if (!wordAnalysis?.syllables?.length) {
    return String(wordAnalysis?.original ?? '');
  }

  const displayStressIndices = getDisplayStressIndices(wordAnalysis);

  return wordAnalysis.syllables
    .map((syllable, index) => {
      if (displayStressIndices.has(index)) {
        return `*${syllable}*`;
      }
      return syllable;
    })
    .join('-');
}

function renderAnnotatedLinePlain(runtime) {
  const chunks = [];
  const { lineAnalysis, activeBoundaries, hemistichBoundaries } = runtime;

  for (let index = 0; index < lineAnalysis.analyses.length; index += 1) {
    chunks.push(formatWordPlain(lineAnalysis.analyses[index]));

    if (index >= lineAnalysis.analyses.length - 1) {
      continue;
    }

    const boundary = activeBoundaries[index];
    const separator = lineAnalysis.separators[index] ?? ' ';
    const cleanedSeparator = separator.replace(/\//g, '');

    if (!boundary?.active || /[^\s]/.test(cleanedSeparator)) {
      chunks.push(cleanedSeparator);
    }

    if (hemistichBoundaries.includes(index)) {
      chunks.push(' / ');
    }
  }

  return chunks.join('');
}

function renderPositionTrackPlain(runtime) {
  const targetSet = new Set(runtime.effectivePattern);
  const merged = [...new Set([...runtime.metricStress, ...runtime.effectivePattern])].sort((a, b) => a - b);

  if (!merged.length) {
    return '-';
  }

  return merged
    .map((position) => {
      if (!targetSet.has(position)) {
        return String(position);
      }
      const status = resolveVersalStatus(runtime.metricEntries, position, runtime.versalConflictPositions);
      const marker = status === 'green' ? 'G' : status === 'red' ? 'R' : 'Y';
      return `${position}${marker}`;
    })
    .join('-');
}

function buildAnalysisText(runtimes, stanzaSummary) {
  const output = [];
  for (const runtime of runtimes) {
    const rawLine = runtime.lineAnalysis.text;
    if (!rawLine.trim()) {
      output.push('');
      continue;
    }

    output.push(`${renderAnnotatedLinePlain(runtime)} ${runtime.rhyme.label} ${runtime.countLabel}`.trim());
    output.push('');
  }

  return output.join('\n').trimEnd();
}

function applyAnalysisMode() {
  const textMode = state.analysisMode === 'text';
  if (analysisOutput) {
    analysisOutput.classList.toggle('hidden', textMode);
  }
  if (analysisTextOutput) {
    analysisTextOutput.classList.toggle('hidden', !textMode);
  }
  if (analysisModeToggle) {
    analysisModeToggle.textContent = textMode ? 'Modo visual' : 'Modo texto';
  }
}

function captureInlineInputFocus() {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) && !(active instanceof HTMLSelectElement)) {
    return null;
  }

  const role = active.dataset.role;
  const line = active.dataset.line;
  if (!role || line === undefined) {
    return null;
  }

  return {
    role,
    line,
    selectionStart: active.selectionStart,
    selectionEnd: active.selectionEnd
  };
}

function restoreInlineInputFocus(snapshot) {
  if (!snapshot) {
    return;
  }

  const selector = `[data-role="${snapshot.role}"][data-line="${snapshot.line}"]`;
  const input = analysisOutput.querySelector(selector);
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) {
    return;
  }

  input.focus();
  if (
    input instanceof HTMLInputElement &&
    typeof snapshot.selectionStart === 'number' &&
    typeof snapshot.selectionEnd === 'number'
  ) {
    const max = input.value.length;
    const start = Math.max(0, Math.min(snapshot.selectionStart, max));
    const end = Math.max(0, Math.min(snapshot.selectionEnd, max));
    input.setSelectionRange(start, end);
  }
}

function normalizeRhymeChunk(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/y/g, 'i')
    .replace(/[^a-zñü]/g, '');
}

function extractNormalizedVowels(value) {
  return normalizeRhymeChunk(value).replace(/[^aeiou]/g, '');
}

function getStressedVowelFromSyllable(syllable) {
  const original = String(syllable ?? '').normalize('NFC');
  if (!original) {
    return '';
  }

  const accented = original.match(/[áéíóú]/i);
  if (accented?.[0]) {
    return normalizeRhymeChunk(accented[0]).replace(/[^aeiou]/g, '');
  }

  const vowels = extractNormalizedVowels(original).split('');
  if (!vowels.length) {
    return '';
  }

  const strong = vowels.filter((item) => item === 'a' || item === 'e' || item === 'o');
  if (strong.length) {
    return strong[strong.length - 1];
  }

  return vowels[vowels.length - 1];
}

function extractRhymeData(lineAnalysis) {
  const lastWord = lineAnalysis.analyses.at(-1);
  if (!lastWord || !lastWord.syllables.length) {
    return {
      consonantKey: '-',
      assonantKey: '-',
      finalWordKey: '-'
    };
  }

  const normalizedWord = String(lastWord.normalized ?? '').normalize('NFC');
  if (!normalizedWord) {
    return {
      consonantKey: '-',
      assonantKey: '-',
      finalWordKey: '-'
    };
  }

  const stressStart = lastWord.syllables
    .slice(0, lastWord.stressIndex)
    .reduce((total, syllable) => total + String(syllable).length, 0);
  const stressSyllable = String(lastWord.syllables[lastWord.stressIndex] ?? '');
  const vowelOffset = stressSyllable.search(/[aeiouáéíóúü]/i);
  const start = stressStart + (vowelOffset >= 0 ? vowelOffset : 0);
  const rawTail = normalizedWord.slice(start);
  const consonantKey = normalizeRhymeChunk(rawTail) || '-';
  const stressedVowel = getStressedVowelFromSyllable(lastWord.syllables[lastWord.stressIndex]);
  const allWordVowels = extractNormalizedVowels(normalizedWord);
  const lastVowel = allWordVowels ? allWordVowels[allWordVowels.length - 1] : '';
  const assonantKey = `${stressedVowel}${lastVowel}` || '-';
  const finalWordKey = normalizeValidationWord(lastWord.original || normalizedWord) || '-';

  return {
    consonantKey,
    assonantKey,
    finalWordKey
  };
}

function getEffectiveRhymeMode(lineIndex) {
  const local = String(getLineOverride(lineIndex).rhymeMode ?? '').trim();
  if (local === 'asonante' || local === 'consonante' || local === 'sextina') {
    return local;
  }
  return state.rhymeMode;
}

function normalizeValidationWord(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

function normalizeRhymeScheme(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function tokenizeRhymeScheme(value, mode = state.rhymeMode) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) {
    return [];
  }

  if (mode === 'sextina') {
    const grouped = raw.match(/[A-Z]+/g) ?? [];
    const tokens = [];

    for (const chunk of grouped) {
      if (chunk.length === 6) {
        tokens.push(...chunk.split(''));
        continue;
      }

      tokens.push(chunk);
    }

    return tokens;
  }

  return normalizeRhymeScheme(raw).split('').filter(Boolean);
}

function markRhymeSchemeFailure(lineStatus, runtime, reason) {
  if (!runtime || !reason) {
    return;
  }

  const existing = lineStatus.get(runtime.lineIndex) ?? { valid: true, reasons: [], expectedLetter: '', verseNumber: 0 };
  existing.valid = false;
  existing.reasons = [...existing.reasons, reason];
  lineStatus.set(runtime.lineIndex, existing);
}

function validateRhymeScheme(runtimes, schemeValue, mode = state.rhymeMode) {
  const verseRuntimes = runtimes.filter((runtime) => runtime.lineAnalysis.text.trim());
  const tokens = tokenizeRhymeScheme(schemeValue, mode);
  const scheme = mode === 'sextina' ? tokens.join(' ') : tokens.join('');
  const lineStatus = new Map();

  if (!tokens.length) {
    return {
      valid: true,
      summary: 'Esquema libre',
      failingVerses: [],
      lineStatus,
      scheme
    };
  }

  if (mode === 'sextina') {
    const checkedCount = Math.min(verseRuntimes.length, tokens.length);
    const checkedRuntimes = verseRuntimes.slice(0, checkedCount);
    const baseWords = checkedRuntimes.slice(0, 6).map((runtime) => normalizeValidationWord(runtime.lineAnalysis.lastWord));

    for (let index = 0; index < checkedRuntimes.length; index += 1) {
      const runtime = checkedRuntimes[index];
      const expectedToken = tokens[index] ?? '';
      const current = lineStatus.get(runtime.lineIndex) ?? { valid: true, reasons: [] };
      current.expectedLetter = expectedToken;
      current.verseNumber = index + 1;
      lineStatus.set(runtime.lineIndex, current);

      const lineWords = runtime.lineAnalysis.analyses.map((word) => normalizeValidationWord(word.original)).filter(Boolean);
      const expectedWords = expectedToken
        .split('')
        .map((letter) => baseWords[letter.charCodeAt(0) - 65])
        .filter(Boolean);

      if (!expectedWords.length) {
        markRhymeSchemeFailure(lineStatus, runtime, `Token de sextina inválido: ${expectedToken}.`);
        continue;
      }

      if (expectedToken.length === 1) {
        const finalWord = normalizeValidationWord(runtime.lineAnalysis.lastWord);
        if (finalWord !== expectedWords[0]) {
          markRhymeSchemeFailure(lineStatus, runtime, `Debe cerrar con ${expectedWords[0]}.`);
        }
        continue;
      }

      const missingWords = expectedWords.filter((word) => !lineWords.includes(word));
      if (missingWords.length) {
        markRhymeSchemeFailure(lineStatus, runtime, `Faltan end-words de sextina: ${missingWords.join(', ')}.`);
      }
    }

    const failingVerses = checkedRuntimes
      .map((runtime, index) => ({ runtime, verseNumber: index + 1 }))
      .filter(({ runtime }) => lineStatus.get(runtime.lineIndex)?.valid === false)
      .map(({ verseNumber }) => verseNumber);

    const checkedLabel = checkedCount < verseRuntimes.length || checkedCount < tokens.length
      ? ` (v. 1-${checkedCount})`
      : '';

    return {
      valid: failingVerses.length === 0,
      summary: failingVerses.length ? `${scheme}${checkedLabel}: falla v. ${failingVerses.join(', ')}` : `${scheme}${checkedLabel}`,
      failingVerses,
      lineStatus,
      scheme
    };
  }

  const checkedCount = Math.min(verseRuntimes.length, tokens.length);
  const checkedRuntimes = verseRuntimes.slice(0, checkedCount);

  const letterToKey = new Map();
  const keyToLetter = new Map();

  for (let index = 0; index < checkedRuntimes.length; index += 1) {
    const runtime = checkedRuntimes[index];
    const expectedLetter = tokens[index];
    const actualKey = normalizeValidationWord(runtime.rhyme?.activeKey ?? '');
    const current = lineStatus.get(runtime.lineIndex) ?? { valid: true, reasons: [] };
    current.expectedLetter = expectedLetter;
    current.verseNumber = index + 1;
    lineStatus.set(runtime.lineIndex, current);

    if (!actualKey) {
      markRhymeSchemeFailure(lineStatus, runtime, 'No hay rima definida para este verso.');
      continue;
    }

    if (!letterToKey.has(expectedLetter)) {
      const mappedLetter = keyToLetter.get(actualKey);
      if (mappedLetter && mappedLetter !== expectedLetter) {
        markRhymeSchemeFailure(lineStatus, runtime, `La rima ya se usa en la letra ${mappedLetter}.`);
        continue;
      }

      letterToKey.set(expectedLetter, actualKey);
      keyToLetter.set(actualKey, expectedLetter);
      continue;
    }

    if (letterToKey.get(expectedLetter) !== actualKey) {
      markRhymeSchemeFailure(lineStatus, runtime, `Debe rimar como ${expectedLetter}.`);
    }
  }

  const failingVerses = checkedRuntimes
    .map((runtime, index) => ({ runtime, verseNumber: index + 1 }))
    .filter(({ runtime }) => lineStatus.get(runtime.lineIndex)?.valid === false)
    .map(({ verseNumber }) => verseNumber);

  const checkedLabel = checkedCount < verseRuntimes.length || checkedCount < scheme.length
    ? ` (v. 1-${checkedCount})`
    : '';

  return {
    valid: failingVerses.length === 0,
    summary: failingVerses.length ? `${scheme}${checkedLabel}: falla v. ${failingVerses.join(', ')}` : `${scheme}${checkedLabel}`,
    failingVerses,
    lineStatus,
    scheme
  };
}

function renderRhymeSchemeStatus(runtime, rhymeSchemeValidation) {
  if (!runtime?.lineAnalysis?.text.trim() || !rhymeSchemeValidation?.scheme) {
    return '';
  }

  const status = rhymeSchemeValidation.lineStatus.get(runtime.lineIndex);
  if (!status) {
    return '';
  }

  const expectedLetter = status.expectedLetter || '';
  const classes = ['scheme-chip', status.valid ? 'is-valid' : 'is-invalid'].join(' ');
  const suffix = status.valid ? '✓' : '✕';
  const title = status.reasons.length ? status.reasons.join(' · ') : `Cumple el esquema ${rhymeSchemeValidation.scheme}.`;
  return `<span class="${classes}" title="${escapeHtml(title)}">${escapeHtml(expectedLetter)} ${suffix}</span>`;
}

function getManualRhymeKey(lineIndex) {
  const raw = String(getLineOverride(lineIndex).rhymeText ?? '').trim();
  if (!raw) {
    return '';
  }

  return normalizeRhymeChunk(raw);
}

function getManualRhymeLabel(lineIndex) {
  return String(getLineOverride(lineIndex).rhymeText ?? '').trim();
}

function getRhymeLabel(index) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let number = index;
  let out = '';

  do {
    out = alphabet[number % 26] + out;
    number = Math.floor(number / 26) - 1;
  } while (number >= 0);

  return out;
}

function assignRhymeLabels(runtimes) {
  const labelByGroup = new Map();
  let labelCounter = 0;

  for (const runtime of runtimes) {
    const text = runtime.lineAnalysis.text.trim();
    if (!text) {
      runtime.rhyme.label = '-';
      continue;
    }

    if (runtime.rhyme.manualLabel) {
      runtime.rhyme.label = runtime.rhyme.manualLabel;
      continue;
    }

    if (runtime.rhyme.activeKey === '-') {
      runtime.rhyme.label = '-';
      continue;
    }

    const groupKey = `${runtime.rhyme.mode}:${runtime.rhyme.activeKey}`;
    if (!labelByGroup.has(groupKey)) {
      labelByGroup.set(groupKey, getRhymeLabel(labelCounter));
      labelCounter += 1;
    }

    runtime.rhyme.label = labelByGroup.get(groupKey);
  }
}

function computeAsonanteConsonantMixWarnings(runtimes) {
  const warningsByLine = new Map();
  if (state.rhymeMode !== 'asonante') {
    return warningsByLine;
  }

  const verseRuntimes = runtimes.filter((runtime) => {
    return runtime.lineAnalysis.text.trim() && runtime.rhyme.mode === 'asonante' && runtime.rhyme.assonantKey !== '-';
  });

  const byAsonantKey = new Map();
  for (const runtime of verseRuntimes) {
    const key = runtime.rhyme.assonantKey;
    if (!byAsonantKey.has(key)) {
      byAsonantKey.set(key, []);
    }
    byAsonantKey.get(key).push(runtime);
  }

  for (const [assonantKey, group] of byAsonantKey.entries()) {
    if (group.length < 2) {
      continue;
    }

    const byConsonantKey = new Map();
    for (const runtime of group) {
      const consonantKey = runtime.rhyme.consonantKey;
      if (!byConsonantKey.has(consonantKey)) {
        byConsonantKey.set(consonantKey, []);
      }
      byConsonantKey.get(consonantKey).push(runtime);
    }

    // Warn only when at least two different consonant subgroups are repeated
    // inside the same assonant family. A single repeated subgroup is a normal
    // consonant coincidence and is already marked with "C".
    const repeatedConsonantSubgroups = [...byConsonantKey.values()].filter((items) => items.length >= 2);
    if (repeatedConsonantSubgroups.length < 2) {
      continue;
    }

    for (const subgroup of repeatedConsonantSubgroups) {
      for (const runtime of subgroup) {
        warningsByLine.set(
          runtime.lineIndex,
          `Consonancia dentro de rima asonante (${assonantKey}). Puede mezclar consonante y asonante en la misma serie.`
        );
      }
    }
  }

  return warningsByLine;
}

function computeAsonanteConsonantMatches(runtimes) {
  const matchesByLine = new Map();
  if (state.rhymeMode !== 'asonante') {
    return matchesByLine;
  }

  const verseRuntimes = runtimes.filter((runtime) => {
    return runtime.lineAnalysis.text.trim() && runtime.rhyme.mode === 'asonante' && runtime.rhyme.assonantKey !== '-';
  });

  const byAsonantKey = new Map();
  for (const runtime of verseRuntimes) {
    const key = runtime.rhyme.assonantKey;
    if (!byAsonantKey.has(key)) {
      byAsonantKey.set(key, []);
    }
    byAsonantKey.get(key).push(runtime);
  }

  for (const group of byAsonantKey.values()) {
    if (group.length < 2) {
      continue;
    }

    const byConsonantKey = new Map();
    for (const runtime of group) {
      const consonantKey = runtime.rhyme.consonantKey;
      if (!byConsonantKey.has(consonantKey)) {
        byConsonantKey.set(consonantKey, []);
      }
      byConsonantKey.get(consonantKey).push(runtime);
    }

    for (const subgroup of byConsonantKey.values()) {
      if (subgroup.length < 2) {
        continue;
      }

      for (const runtime of subgroup) {
        matchesByLine.set(runtime.lineIndex, true);
      }
    }
  }

  return matchesByLine;
}

function getDisplayStressIndices(wordAnalysis) {
  const indices = new Set();
  if (!wordAnalysis || !Array.isArray(wordAnalysis.syllables)) {
    return indices;
  }

  if (wordAnalysis.accentType !== 'monosílaba' && Number.isInteger(wordAnalysis.stressIndex)) {
    indices.add(wordAnalysis.stressIndex);
  }

  const secondaryIndices = Array.isArray(wordAnalysis.secondaryStressIndices)
    ? wordAnalysis.secondaryStressIndices
    : [];

  for (const index of secondaryIndices) {
    if (Number.isInteger(index) && index >= 0 && index < wordAnalysis.syllables.length) {
      indices.add(index);
    }
  }

  return indices;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseNumberList(value) {
  const numbers = String(value ?? '')
    .split(/[^0-9]+/)
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isInteger(number) && number > 0);

  return [...new Set(numbers)].sort((a, b) => a - b);
}

function parseStressPattern(value) {
  return parseNumberList(value);
}

function parseHemistichPositions(value) {
  return parseNumberList(value);
}

function buildValidationBoundaries(lineAnalysis, lineIndex) {
  const effectivePattern = getEffectiveStressPattern(lineIndex);
  const localOverride = getLineOverride(lineIndex);
  const forceOn = parseNumberList(localOverride.sinalefaOn ?? '');
  const forceOff = parseNumberList(localOverride.sinalefaOff ?? '');

  return lineAnalysis.boundaries.map((boundary) => {
    const boundaryUiIndex = boundary.index + 1;
    const blockedByPause = state.conservativeSinalefa && boundary.strongPause;
    const blockedByStress =
      effectivePattern.includes(boundary.boundaryPosition) ||
      effectivePattern.includes(boundary.boundaryPosition + 1);

    let active = state.sinalefaEnabled && boundary.candidate && !blockedByPause && !blockedByStress;

    if (Object.prototype.hasOwnProperty.call(state.sinalefaOverrides, `${lineIndex}:${boundary.index}`)) {
      active = Boolean(state.sinalefaOverrides[`${lineIndex}:${boundary.index}`]) && boundary.candidate;
    }

    if (forceOn.includes(boundaryUiIndex) && boundary.candidate) {
      active = true;
    }

    if (forceOff.includes(boundaryUiIndex)) {
      active = false;
    }

    return {
      ...boundary,
      uiIndex: boundaryUiIndex,
      blockedByPause,
      blockedByStress,
      active
    };
  });
}

function getLineOverride(lineIndex) {
  return state.lineOverrides[lineIndex] ?? {};
}

function getEffectiveStressPattern(lineIndex) {
  const local = parseStressPattern(getLineOverride(lineIndex).stress ?? '');
  return getLineOverride(lineIndex).stress?.trim() ? local : state.stressPattern;
}

function getEffectiveHemistichPositions(lineAnalysis, lineIndex) {
  const inlineHemistich = getInlineHemistichBoundaries(lineAnalysis);
  if (inlineHemistich.length) {
    return { boundaries: inlineHemistich, invalid: [] };
  }

  if (!state.hemistichEnabled) {
    return { boundaries: [], invalid: [] };
  }

  const override = getLineOverride(lineIndex).hemistich;
  const inputPositions = override?.trim() ? parseHemistichPositions(override) : state.hemistichPositions;
  const validationBoundaries = buildValidationBoundaries(lineAnalysis, lineIndex);

  const total = lineAnalysis.rawCount;
  const boundaries = [];
  const invalid = [];
  let previousBoundary = -1;
  let previousTarget = 0;
  let activeMergesBeforeBoundary = 0;

  for (const target of inputPositions) {
    if (target >= total) {
      invalid.push({ target, reason: 'fuera de rango' });
      continue;
    }

    const segmentTarget = target - previousTarget;
    let cursor = 0;
    let found = null;
    let reason = 'no encaja';
    let mergesBeforeCurrent = 0;

    for (let index = previousBoundary + 1; index < lineAnalysis.analyses.length - 1; index += 1) {
      cursor += lineAnalysis.analyses[index].syllableCount;
      const lastWord = lineAnalysis.analyses[index];
      const boundary = validationBoundaries[index];
      const metricCount = adjustPoeticCount(cursor - mergesBeforeCurrent, lastWord.accentType);

      if (metricCount === segmentTarget) {
        found = index;
        break;
      }

      if (metricCount > segmentTarget && lastWord.accentType === 'aguda') {
        reason = 'aguda desplaza el corte';
      }

      if (metricCount >= segmentTarget && found === null) {
        reason = metricCount > segmentTarget ? reason : 'la palabra final no ajusta';
      }

      if (boundary?.active) {
        mergesBeforeCurrent += 1;
      }
    }

    if (found === null || found >= lineAnalysis.analyses.length - 1) {
      invalid.push({ target, reason });
    } else {
      boundaries.push(found);
      previousBoundary = found;
      previousTarget = target;
    }
  }

  return {
    boundaries: [...new Set(boundaries)].sort((a, b) => a - b),
    invalid
  };
}

function getInlineHemistichBoundaries(lineAnalysis) {
  const slashIndices = [...lineAnalysis.text.matchAll(/\//g)].map((item) => item.index ?? -1).filter((i) => i >= 0);
  const boundaries = [];

  for (const slashIndex of slashIndices) {
    const matches = lineAnalysis.wordMatches;
    for (let index = 0; index < matches.length - 1; index += 1) {
      if (matches[index].end <= slashIndex && matches[index + 1].start >= slashIndex) {
        boundaries.push(index);
        break;
      }
    }
  }

  return [...new Set(boundaries)].sort((a, b) => a - b);
}

function wordHasMainStress(wordAnalysis) {
  if (wordAnalysis.syllableCount !== 1) {
    return true;
  }

  return !isUnstressedMonosyllable(wordAnalysis.original);
}

function buildSyllableEntries(lineAnalysis, activeBoundaries) {
  const entries = [];
  let position = 1;

  lineAnalysis.analyses.forEach((analysis, wordIndex) => {
    for (let syllableIndex = 0; syllableIndex < analysis.syllableCount; syllableIndex += 1) {
      entries.push({
        originalPosition: position,
        wordIndex,
        syllableIndex,
        isStress: syllableIndex === analysis.stressIndex && wordHasMainStress(analysis),
        wordHasStress: wordHasMainStress(analysis)
      });
      position += 1;
    }
  });

  for (const entry of entries) {
    const shift = activeBoundaries.reduce((total, boundary) => {
      return boundary.active && boundary.boundaryPosition < entry.originalPosition ? total + 1 : total;
    }, 0);
    entry.effectivePosition = entry.originalPosition - shift;
  }

  return entries;
}

function getNaturalStressPositions(entries) {
  return [...new Set(entries.filter((entry) => entry.isStress).map((entry) => entry.effectivePosition))].sort((a, b) => a - b);
}

function buildMetricSegmentData(lineAnalysis, activeBoundaries, hemistichBoundaries) {
  const segments = [];
  const segmentBoundaries = [-1, ...hemistichBoundaries, lineAnalysis.analyses.length - 1];
  let cumulativeMetricOffset = 0;

  for (let idx = 0; idx < segmentBoundaries.length - 1; idx += 1) {
    const startBoundary = segmentBoundaries[idx];
    const endBoundary = segmentBoundaries[idx + 1];
    const words = lineAnalysis.analyses.slice(startBoundary + 1, endBoundary + 1);

    if (!words.length) {
      continue;
    }

    const segmentMerges = activeBoundaries.filter((item) => item.active && item.index > startBoundary && item.index < endBoundary).length;
    const raw = words.reduce((total, word) => total + word.syllableCount, 0) - segmentMerges;
    const accentType = words.at(-1)?.accentType ?? 'llana';
    const metric = adjustPoeticCount(raw, accentType);
    const bonus = metric - raw;

    segments.push({
      idx,
      startWord: startBoundary + 1,
      endWord: endBoundary,
      raw,
      metric,
      bonus,
      offsetBefore: cumulativeMetricOffset,
      accentType
    });

    cumulativeMetricOffset += bonus;
  }

  return segments;
}

function buildMetricStressData(entries, segments) {
  const metricEntries = [];
  const metricStress = [];

  for (const entry of entries) {
    const segment = segments.find((item) => entry.wordIndex >= item.startWord && entry.wordIndex <= item.endWord);
    if (!segment) {
      continue;
    }

    const metricPosition = entry.effectivePosition + segment.offsetBefore;
    metricEntries.push({
      ...entry,
      metricPosition,
      segmentIndex: segment.idx
    });

    if (entry.isStress) {
      metricStress.push(metricPosition);
    }
  }

  return {
    metricEntries,
    metricStress: [...new Set(metricStress)].sort((a, b) => a - b)
  };
}

function getSegmentFinalStressPositions(metricEntries, segments) {
  const positions = [];

  for (const segment of segments) {
    const segmentStress = metricEntries
      .filter((entry) => entry.segmentIndex === segment.idx && entry.isStress)
      .map((entry) => entry.metricPosition);

    if (segmentStress.length) {
      positions.push(Math.max(...segmentStress));
    }
  }

  return [...new Set(positions)].sort((a, b) => a - b);
}

function resolveVersalStatus(entries, targetPosition, conflictPositions = new Set()) {
  if (conflictPositions.has(targetPosition)) {
    return 'yellow';
  }

  const onTarget = entries.filter((entry) => entry.metricPosition === targetPosition);

  if (!onTarget.length) {
    return 'yellow';
  }

  if (onTarget.some((entry) => entry.isStress)) {
    return 'green';
  }

  if (onTarget.some((entry) => entry.wordHasStress)) {
    return 'red';
  }

  return 'yellow';
}

function isVowelForChain(ch) {
  return /[aeiouaeiouuyáéíóúü]/i.test(ch);
}

function normalizeVowelForChain(ch) {
  const lower = String(ch ?? '').toLowerCase();
  if (lower === 'y') {
    return 'y';
  }
  return lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isWeakVowelForChain(ch) {
  const normalized = normalizeVowelForChain(ch);
  return normalized === 'i' || normalized === 'u' || normalized === 'y';
}

function isStrongVowelForChain(ch) {
  const normalized = normalizeVowelForChain(ch);
  return normalized === 'a' || normalized === 'e' || normalized === 'o';
}

function isAccentedWeakForChain(ch) {
  const lower = String(ch ?? '').toLowerCase();
  return lower === 'í' || lower === 'ú';
}

function extractVowelsForChain(text) {
  return [...String(text ?? '').toLowerCase()].filter((ch) => isVowelForChain(ch));
}

function canMergeBoundariesAsTriphthong(lineAnalysis, leftBoundaryIndex) {
  const middleWord = lineAnalysis?.analyses?.[leftBoundaryIndex + 1];
  const leftWord = lineAnalysis?.analyses?.[leftBoundaryIndex];
  const rightWord = lineAnalysis?.analyses?.[leftBoundaryIndex + 2];

  if (!middleWord || !leftWord || !rightWord) {
    return false;
  }

  // A merged triphthong across two boundaries only makes sense when the middle word
  // contributes a single vocalic nucleus (typically a monosyllable like "a" or "y").
  if (middleWord.syllableCount !== 1) {
    return false;
  }

  const leftSyllable = leftWord.syllables.at(-1) ?? '';
  const middleSyllable = middleWord.syllables[0] ?? '';
  const rightSyllable = rightWord.syllables[0] ?? '';

  const leftVowels = extractVowelsForChain(leftSyllable);
  const middleVowels = extractVowelsForChain(middleSyllable);
  const rightVowels = extractVowelsForChain(rightSyllable);

  if (!leftVowels.length || !rightVowels.length || middleVowels.length !== 1) {
    return false;
  }

  const leftVowel = leftVowels.at(-1);
  const middleVowel = middleVowels[0];
  const rightVowel = rightVowels[0];

  return (
    isWeakVowelForChain(leftVowel) &&
    isStrongVowelForChain(middleVowel) &&
    isWeakVowelForChain(rightVowel) &&
    !isAccentedWeakForChain(leftVowel) &&
    !isAccentedWeakForChain(rightVowel)
  );
}

function applySinalefaChains(lineAnalysis, activeBoundaries) {
  const sinalefaChains = [];
  let chainStart = null;

  for (let index = 0; index < activeBoundaries.length; index += 1) {
    const boundary = activeBoundaries[index];
    if (boundary.candidate && boundary.active) {
      if (chainStart === null) {
        chainStart = index;
      } else if (!canMergeBoundariesAsTriphthong(lineAnalysis, index - 1)) {
        sinalefaChains.push({ start: chainStart, end: index - 1 });
        chainStart = index;
      }
      continue;
    }

    if (chainStart !== null) {
      sinalefaChains.push({ start: chainStart, end: index - 1 });
      chainStart = null;
    }
  }

  if (chainStart !== null) {
    sinalefaChains.push({ start: chainStart, end: activeBoundaries.length - 1 });
  }

  for (const boundary of activeBoundaries) {
    boundary.chainStart = boundary.index;
    boundary.chainEnd = boundary.index;
    boundary.chainLength = 0;
    boundary.isChainHead = false;
    boundary.isChainTail = false;
  }

  for (const chain of sinalefaChains) {
    for (let index = chain.start; index <= chain.end; index += 1) {
      activeBoundaries[index].chainStart = chain.start;
      activeBoundaries[index].chainEnd = chain.end;
      activeBoundaries[index].chainLength = chain.end - chain.start + 1;
      activeBoundaries[index].isChainHead = index === chain.start;
      activeBoundaries[index].isChainTail = index === chain.end;
    }
  }

  return sinalefaChains;
}

function buildLineRuntime(lineAnalysis, lineIndex) {
  const effectivePattern = getEffectiveStressPattern(lineIndex);
  const inlineHemistich = getInlineHemistichBoundaries(lineAnalysis);
  const configHemistich = getEffectiveHemistichPositions(lineAnalysis, lineIndex);
  const hemistichBoundaries = inlineHemistich.length ? inlineHemistich : configHemistich.boundaries;
  const hasHemistich = hemistichBoundaries.length > 0;

  const localOverride = getLineOverride(lineIndex);
  const forceOn = parseNumberList(localOverride.sinalefaOn ?? '');
  const forceOff = parseNumberList(localOverride.sinalefaOff ?? '');

  const activeBoundaries = lineAnalysis.boundaries.map((boundary) => {
    const key = `${lineIndex}:${boundary.index}`;
    const boundaryUiIndex = boundary.index + 1;
    const blockedByPause = state.conservativeSinalefa && boundary.strongPause;
    const blockedByStress =
      effectivePattern.includes(boundary.boundaryPosition) ||
      effectivePattern.includes(boundary.boundaryPosition + 1);
    const blockedByHemistich = hemistichBoundaries.includes(boundary.index);

    let active = state.sinalefaEnabled && boundary.candidate && !blockedByPause && !blockedByStress && !blockedByHemistich;

    const hasManualOverride = !blockedByHemistich && Object.prototype.hasOwnProperty.call(state.sinalefaOverrides, key);
    const manualOverrideOn = hasManualOverride && Boolean(state.sinalefaOverrides[key]) && boundary.candidate;
    const forceOnByLine = forceOn.includes(boundaryUiIndex) && !blockedByHemistich && boundary.candidate;

    if (hasManualOverride) {
      active = manualOverrideOn;
    }

    if (forceOnByLine) {
      active = true;
    }

    if (forceOff.includes(boundaryUiIndex)) {
      active = false;
    }

    return {
      ...boundary,
      uiIndex: boundaryUiIndex,
      blockedByPause,
      blockedByStress,
      blockedByHemistich,
      active,
      forcedOn: manualOverrideOn || forceOnByLine
    };
  });
  let sinalefaChains = applySinalefaChains(lineAnalysis, activeBoundaries);

  function computeMetricState() {
    const entries = buildSyllableEntries(lineAnalysis, activeBoundaries);
    const naturalStress = getNaturalStressPositions(entries);

    const merges = activeBoundaries.filter((item) => item.active).length;
    const effectiveRawCount = lineAnalysis.rawCount - merges;

    const segments = buildMetricSegmentData(lineAnalysis, activeBoundaries, hemistichBoundaries);
    const segmentCounts = segments.map((item) => item.metric);
    const { metricEntries, metricStress } = buildMetricStressData(entries, segments);
    const segmentFinalStress = getSegmentFinalStressPositions(metricEntries, segments);
    const effectivePatternWithNatural = [
      ...new Set([...effectivePattern, ...segmentFinalStress])
    ].sort((a, b) => a - b);
    const versalConflictPositions = new Set();
    const versalConflictBoundaryIndices = new Set();
    const firstMetricPosByWord = new Map();
    const lastMetricPosByWord = new Map();

    for (const entry of metricEntries) {
      if (!firstMetricPosByWord.has(entry.wordIndex)) {
        firstMetricPosByWord.set(entry.wordIndex, entry.metricPosition);
      }
      lastMetricPosByWord.set(entry.wordIndex, entry.metricPosition);
    }

    for (const boundary of activeBoundaries) {
      if (!boundary.active) {
        continue;
      }

      let hasConflict = false;
      const leftMetricPos = lastMetricPosByWord.get(boundary.index);
      const rightMetricPos = firstMetricPosByWord.get(boundary.index + 1);

      if (Number.isInteger(leftMetricPos) && effectivePatternWithNatural.includes(leftMetricPos)) {
        versalConflictPositions.add(leftMetricPos);
        hasConflict = true;
      }

      if (Number.isInteger(rightMetricPos) && effectivePatternWithNatural.includes(rightMetricPos)) {
        versalConflictPositions.add(rightMetricPos);
        hasConflict = true;
      }

      if (hasConflict) {
        versalConflictBoundaryIndices.add(boundary.index);
      }
    }

    const countLabel = segmentCounts.length > 1 ? segmentCounts.join('+') : String(adjustPoeticCount(effectiveRawCount, lineAnalysis.accentType));
    const metricVerseCount = segmentCounts.length > 1 ? null : adjustPoeticCount(effectiveRawCount, lineAnalysis.accentType);
    const hemistichWarning = !hasHemistich && Number.isFinite(metricVerseCount) && metricVerseCount > 11
      ? `Verso de ${metricVerseCount} sílabas métricas sin hemistiquio.`
      : '';

    return {
      entries,
      naturalStress,
      segments,
      metricEntries,
      metricStress,
      effectivePatternWithNatural,
      versalConflictPositions,
      versalConflictBoundaryIndices,
      countLabel,
      hemistichWarning
    };
  }

  let metricState = computeMetricState();
  let autoBreakApplied = false;

  for (const boundary of activeBoundaries) {
    if (!boundary.active || boundary.forcedOn) {
      continue;
    }

    if (metricState.versalConflictBoundaryIndices.has(boundary.index)) {
      boundary.active = false;
      autoBreakApplied = true;
    }
  }

  if (autoBreakApplied) {
    sinalefaChains = applySinalefaChains(lineAnalysis, activeBoundaries);
    metricState = computeMetricState();
  }

  const sinalefaNotice = metricState.versalConflictPositions.size
    ? 'Hay sinalefas forzadas sobre acento versal (amarillo). Detectar automáticamente las rompe si no están forzadas.'
    : '';

  const rhymeData = extractRhymeData(lineAnalysis);
  const mode = getEffectiveRhymeMode(lineIndex);
  const manualKey = getManualRhymeKey(lineIndex);
  const manualLabel = getManualRhymeLabel(lineIndex);
  const activeKey = manualKey || (mode === 'consonante'
    ? rhymeData.consonantKey
    : mode === 'sextina'
      ? rhymeData.finalWordKey
      : rhymeData.assonantKey);

  return {
    lineIndex,
    lineAnalysis,
    effectivePattern: metricState.effectivePatternWithNatural,
    activeBoundaries,
    hemistichBoundaries,
    hasHemistich,
    invalidHemistich: configHemistich.invalid,
    entries: metricState.entries,
    metricEntries: metricState.metricEntries,
    metricStress: metricState.metricStress,
    segments: metricState.segments,
    naturalStress: metricState.naturalStress,
    countLabel: metricState.countLabel,
    hemistichWarning: metricState.hemistichWarning,
    rhyme: {
      mode,
      consonantKey: rhymeData.consonantKey,
      assonantKey: rhymeData.assonantKey,
      finalWordKey: rhymeData.finalWordKey,
      manualLabel,
      manualKey,
      activeKey,
      label: '-'
    },
    sinalefaChains,
    versalConflictPositions: metricState.versalConflictPositions,
    versalConflictBoundaryIndices: metricState.versalConflictBoundaryIndices,
    sinalefaNotice
  };
}

function renderSinalefaChainLabel(runtime, startIndex, endIndex) {
  const leftWord = runtime?.lineAnalysis?.analyses?.[startIndex];
  const firstBoundary = runtime?.activeBoundaries?.[startIndex];
  const chainParts = [];

  if (!leftWord?.syllables?.length || !firstBoundary) {
    return '';
  }

  chainParts.push(leftWord.syllables.at(-1));

  for (let index = startIndex; index <= endIndex; index += 1) {
    const rightWord = runtime?.lineAnalysis?.analyses?.[index + 1];
    const rightSyllable = rightWord?.syllables?.[0] ?? '';
    if (rightSyllable) {
      chainParts.push(rightSyllable);
    }
  }

  const joined = chainParts.map((item) => escapeHtml(item)).join('');
  return `(${joined})`;
}

function renderRhyme(runtime) {
  const modeLabel = runtime.rhyme.mode === 'consonante' ? 'consonante' : runtime.rhyme.mode === 'sextina' ? 'sextina' : 'asonante';
  const source = runtime.rhyme.manualLabel ? 'manual' : modeLabel;
  const label = String(runtime.rhyme.label ?? '').trim();
  const mixWarning = String(runtime.rhyme.mixWarning ?? '').trim();
  const consonantMatchHint = String(runtime.rhyme.consonantMatchHint ?? '').trim();
  const colorIndex = label && label !== '-' ? (label.toUpperCase().charCodeAt(0) - 65) % 6 : 0;
  const colorClass = `rhyme-tone-${colorIndex}`;
  const warningHint = mixWarning ? `<span class="hover-hint" title="${escapeHtml(mixWarning)}">!</span>` : '';
  const consonantHint = consonantMatchHint ? `<span class="hover-hint" title="${escapeHtml(consonantMatchHint)}">C</span>` : '';
  return `<span class="rhyme-chip ${colorClass}" title="Rima ${escapeHtml(source)} activa. Clave usada: ${escapeHtml(runtime.rhyme.activeKey)}. Consonante: ${escapeHtml(runtime.rhyme.consonantKey)}. Asonante: ${escapeHtml(runtime.rhyme.assonantKey)}. Final completa: ${escapeHtml(runtime.rhyme.finalWordKey)}.">${escapeHtml(runtime.rhyme.label)}</span>${consonantHint}${warningHint}`;
}

function formatWordInline(wordAnalysis) {
  if (!wordAnalysis.syllables.length) {
    return escapeHtml(wordAnalysis.original);
  }

  if (wordAnalysis.accentType === 'monosílaba') {
    return wordAnalysis.syllables.map((syllable) => escapeHtml(syllable)).join('-');
  }

  const displayStressIndices = getDisplayStressIndices(wordAnalysis);

  return wordAnalysis.syllables
    .map((syllable, index) => {
      const clean = escapeHtml(syllable);
      return displayStressIndices.has(index) ? `<strong>${clean}</strong>` : clean;
    })
    .join('-');
}

function renderWordInlineWithBoundaryAwareness(wordAnalysis, wordIndex, runtime) {
  if (!wordAnalysis.syllables.length) {
    return escapeHtml(wordAnalysis.original);
  }

  const previousBoundary = runtime.activeBoundaries[wordIndex - 1];
  const nextBoundary = runtime.activeBoundaries[wordIndex];
  const hideFirst = Boolean(previousBoundary?.candidate && !previousBoundary?.blockedByHemistich);
  const hideLast = Boolean(nextBoundary?.candidate && !nextBoundary?.blockedByHemistich);
  const displayStressIndices = getDisplayStressIndices(wordAnalysis);

  const syllables = wordAnalysis.syllables
    .map((syllable, index) => {
      const isFirst = index === 0;
      const isLast = index === wordAnalysis.syllables.length - 1;
      if ((isFirst && hideFirst) || (isLast && hideLast)) {
        return '';
      }

      const clean = escapeHtml(syllable);
      return displayStressIndices.has(index) ? `<strong>${clean}</strong>` : clean;
    })
    .filter(Boolean)
    .join('-');

  return syllables;
}

function renderSinalefaMarker(boundary, lineIndex) {
  if (!boundary.candidate) {
    return '';
  }

  const runtime = lastRuntime[lineIndex];
  const previousBoundary = runtime?.activeBoundaries?.[boundary.index - 1];
  const nextBoundary = runtime?.activeBoundaries?.[boundary.index + 1];
  const leftWord = runtime?.lineAnalysis?.analyses?.[boundary.index];
  const rightWord = runtime?.lineAnalysis?.analyses?.[boundary.index + 1];
  const leftSyllable = leftWord?.syllables?.at(-1) ?? '';
  const rightSyllable = rightWord?.syllables?.[0] ?? '';
  const leftStress = leftWord && wordHasMainStress(leftWord) && leftWord.stressIndex === leftWord.syllables.length - 1;
  const rightStress = rightWord && wordHasMainStress(rightWord) && rightWord.stressIndex === 0;
  const mergedTonic = boundary.active && (leftStress || rightStress);
  const inactiveLabel = `(${(leftStress ? `<strong>${escapeHtml(leftSyllable)}</strong>` : escapeHtml(leftSyllable))} ${(rightStress ? `<strong>${escapeHtml(rightSyllable)}</strong>` : escapeHtml(rightSyllable))})`;
  const label = boundary.active && boundary.chainLength > 1
    ? renderSinalefaChainLabel(runtime, boundary.chainStart, boundary.chainEnd)
    : boundary.active
      ? `(${(mergedTonic || leftStress) ? `<strong>${escapeHtml(leftSyllable)}</strong>` : escapeHtml(leftSyllable)}${(mergedTonic || rightStress) ? `<strong>${escapeHtml(rightSyllable)}</strong>` : escapeHtml(rightSyllable)})`
      : inactiveLabel;

  const classes = [
    'sinalefa-toggle',
    boundary.active ? 'is-active' : 'is-inactive',
    boundary.active && (boundary.chainLength > 1 || runtime?.versalConflictBoundaryIndices?.has(boundary.index)) ? 'is-warning' : '',
    boundary.blockedByHemistich ? 'is-locked' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const title = boundary.blockedByHemistich
    ? 'Bloqueada por hemistiquio'
    : boundary.active && boundary.chainLength > 1
      ? `Triptongo: ${boundary.chainLength} sinalefas enlazadas. Clic para separar.`
      : boundary.active && runtime?.versalConflictBoundaryIndices?.has(boundary.index)
        ? 'Sinalefa forzada sobre acento versal: se marca en amarillo.'
      : boundary.blockedByStress
        ? 'El acento versal rompe la sinalefa automática en este punto.'
        : `Sinalefa ${boundary.uiIndex}: clic para alternar`;

  const disabled = boundary.blockedByHemistich ? 'disabled' : '';
  const clickBoundary = boundary.active && boundary.chainLength > 1 ? boundary.chainEnd : boundary.index;
  return `<button type="button" class="${classes}" data-line="${lineIndex}" data-boundary="${clickBoundary}" title="${escapeHtml(title)}" ${disabled}>${label}</button>`;
}

function renderAnnotatedLine(runtime) {
  const chunks = [];
  const { lineAnalysis, activeBoundaries, lineIndex, hemistichBoundaries } = runtime;

  for (let index = 0; index < lineAnalysis.analyses.length; index += 1) {
    chunks.push(renderWordInlineWithBoundaryAwareness(lineAnalysis.analyses[index], index, runtime));

    if (index >= lineAnalysis.analyses.length - 1) {
      continue;
    }

    const boundary = activeBoundaries[index];
    const previousBoundary = activeBoundaries[index - 1];
    const belongsToSameChain =
      boundary?.active &&
      previousBoundary?.active &&
      previousBoundary?.candidate &&
      boundary.chainLength > 1 &&
      previousBoundary.chainLength > 1 &&
      boundary.chainStart === previousBoundary.chainStart;

    if (belongsToSameChain) {
      continue;
    }

    const separator = lineAnalysis.separators[index] ?? ' ';
    const noSlash = hemistichBoundaries.includes(index) ? separator.replace(/\//g, '') : separator;

    chunks.push(escapeHtml(noSlash));

    if (hemistichBoundaries.includes(index)) {
      chunks.push('<span class="hemistich-marker"> / </span>');
    }

    chunks.push(renderSinalefaMarker(boundary, lineIndex));
  }

  return chunks.join('');
}

function renderPositionTrack(runtime) {
  const renderPositionToken = (position, offsetBefore = 0) => {
    const localPosition = position - offsetBefore;
    if (!targetSet.has(position)) {
      return `${localPosition}`;
    }

    const status = resolveVersalStatus(runtime.metricEntries, position);
    return `<span class="vpos ${status}">${localPosition}</span>`;
  };

  const targetSet = new Set(runtime.effectivePattern);

  const merged = [...new Set([...runtime.metricStress, ...runtime.effectivePattern])].sort((a, b) => a - b);

  if (!merged.length) {
    return '-';
  }

  if (runtime.hasHemistich && runtime.segments.length > 1) {
    const segmentTracks = runtime.segments
      .map((segment) => {
        const start = segment.offsetBefore + 1;
        const end = segment.offsetBefore + segment.metric;
        const segmentPositions = merged.filter((position) => position >= start && position <= end);

        if (!segmentPositions.length) {
          return '';
        }

        return segmentPositions
          .map((position) => renderPositionToken(position, segment.offsetBefore))
          .join('-');
      })
      .filter(Boolean);

    return segmentTracks.length ? segmentTracks.join('-/') : '-';
  }

  return merged
    .map((position) => renderPositionToken(position))
    .join('-');
}

function renderInvalidHemistich(runtime) {
  if (!runtime.invalidHemistich.length) {
    return '';
  }

  return runtime.invalidHemistich
    .map((item) => `<span class="invalid-hemi" title="Hemistiquio ${item.target}: ${escapeHtml(item.reason)}">H${item.target}!</span>`)
    .join(' ');
}

function renderLineAdvanced(runtime) {
  const override = getLineOverride(runtime.lineIndex);
  const lineRhymeText = String(override.rhymeText ?? '').trim();
  const openAttr = state.openAdvancedByLine[runtime.lineIndex] ? 'open' : '';
  return `
    <details class="line-advanced" data-line="${runtime.lineIndex}" ${openAttr}>
      <summary aria-label="Abrir avanzado">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span class="sr-only">Avanzado</span>
      </summary>
      <div class="line-advanced-grid">
        <label>
          Acento versal
          <input type="text" data-role="line-stress" data-line="${runtime.lineIndex}" value="${escapeHtml(override.stress ?? '')}" placeholder="${escapeHtml(state.stressPattern.join('-'))}" title="Posiciones de acento versal para esta línea (ej: 4-8-10)." />
        </label>
        <label>
          Hemistiquio
          <input type="text" data-role="line-hemi" data-line="${runtime.lineIndex}" value="${escapeHtml(override.hemistich ?? '')}" placeholder="${escapeHtml(state.hemistichPositions.join(','))}" title="Cortes de hemistiquio para esta línea (ej: 6,12)." />
        </label>
        <label>
          Rima (override)
          <input type="text" data-role="line-rhyme-text" data-line="${runtime.lineIndex}" value="${escapeHtml(lineRhymeText)}" placeholder="Auto (${escapeHtml(state.rhymeMode)})" title="Escribe una clave de rima para esta línea (ej: A, aa, ada). Vacío = automático." />
        </label>
      </div>
    </details>
  `;
}

function renderAnalysis(result) {
  if (!result.lines.length) {
    analysisOutput.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Escribe un poema para ver la escansión.</strong>
        </div>
      </div>
    `;
    if (analysisTextOutput) {
      analysisTextOutput.textContent = 'Escribe un poema para ver la escansión en formato texto.';
    }
    applyAnalysisMode();
    return;
  }

  const runtimes = result.lines.map((line, index) => buildLineRuntime(line, index));
  assignRhymeLabels(runtimes);
  const asonanteMixWarnings = computeAsonanteConsonantMixWarnings(runtimes);
  const asonanteConsonantMatches = computeAsonanteConsonantMatches(runtimes);
  for (const runtime of runtimes) {
    runtime.rhyme.mixWarning = asonanteMixWarnings.get(runtime.lineIndex) ?? '';
    runtime.rhyme.consonantMatchHint = asonanteConsonantMatches.has(runtime.lineIndex)
      ? 'Este verso coincide en rima consonante dentro de su serie asonante.'
      : '';
  }
  lastRuntime = runtimes;
  const rhymeSchemeValidation = validateRhymeScheme(runtimes, state.rhymeScheme, state.rhymeMode);

  if (rhymeSchemeBadge) {
    rhymeSchemeBadge.className = rhymeSchemeValidation.valid ? 'badge scheme-badge is-valid' : 'badge scheme-badge is-invalid';
    rhymeSchemeBadge.textContent = rhymeSchemeValidation.summary;
  }

  analysisOutput.innerHTML = `
    <section class="clean-analysis">
      <div class="analysis-lines">
        ${runtimes
          .map((runtime) => {
            if (!runtime.lineAnalysis.text.trim()) {
              return '<div class="stanza-gap" aria-hidden="true"></div>';
            }

            return `
              <div class="analysis-line-wrap">
                <div class="analysis-row">
                  <div class="analysis-col visual-col">${renderAnnotatedLine(runtime)}</div>
                  <div class="analysis-col stress-col">${renderPositionTrack(runtime)} ${renderInvalidHemistich(runtime)}${runtime.sinalefaNotice ? `<span class="hover-hint" title="${escapeHtml(runtime.sinalefaNotice)}">!</span>` : ''}</div>
                  <div class="analysis-col rhyme-col">${renderRhyme(runtime)}</div>
                  <div class="analysis-col scheme-col">${renderRhymeSchemeStatus(runtime, rhymeSchemeValidation)}</div>
                  <div class="analysis-col advanced-col">${renderLineAdvanced(runtime)}</div>
                  <div class="analysis-col count-col">${runtime.countLabel}${runtime.hemistichWarning ? ` <span class="hover-hint" title="${escapeHtml(runtime.hemistichWarning)}">!</span>` : ''}</div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>
  `;

  if (analysisTextOutput) {
    analysisTextOutput.textContent = buildAnalysisText(runtimes, result.stanzaSummary ?? '1');
  }
  applyAnalysisMode();
}

function syncStateFromControls() {
  state.stressPattern = parseStressPattern(stressCustom.value);
  state.hemistichPositions = parseHemistichPositions(hemistichSplit.value);
  state.hemistichEnabled = state.hemistichPositions.length > 0;
  state.rhymeMode = rhymeMode?.value === 'consonante' ? 'consonante' : rhymeMode?.value === 'sextina' ? 'sextina' : 'asonante';
  state.rhymeScheme = rhymeScheme?.value ?? '';
  state.sinalefaEnabled = true;
}

function syncRhymeSchemePreset() {
  if (!rhymeMode || !rhymeScheme) {
    return;
  }

  const normalizedCurrent = String(rhymeScheme.value ?? '').trim();
  if (rhymeMode.value === 'sextina') {
    if (!normalizedCurrent || normalizedCurrent === DEFAULT_SEXTINA_SCHEME) {
      rhymeScheme.value = DEFAULT_SEXTINA_SCHEME;
    }
    return;
  }

  if (normalizedCurrent === DEFAULT_SEXTINA_SCHEME) {
    rhymeScheme.value = '';
  }
}

function buildStanzaSummary(text) {
  const lines = normalizeInput(text).split('\n');
  const stanzaCounts = [];
  let versesInStanza = 0;

  for (const line of lines) {
    if (line.trim()) {
      versesInStanza += 1;
      continue;
    }

    if (versesInStanza > 0) {
      stanzaCounts.push(versesInStanza);
      versesInStanza = 0;
    }
  }

  if (versesInStanza > 0) {
    stanzaCounts.push(versesInStanza);
  }

  return stanzaCounts.length ? stanzaCounts.join('-') : '1';
}

function updateAnalysis() {
  const focusSnapshot = captureInlineInputFocus();
  setPoemTitleDisplay(poemTitle?.value ?? '');
  syncRhymeSchemePreset();
  syncStateFromControls();
  const text = normalizeInput(poemInput.value);
  const result = analyzePoem(text);
  const stanzaSummary = buildStanzaSummary(text);
  if (stanzaSummaryBadge) {
    stanzaSummaryBadge.textContent = stanzaSummary;
  }
  renderAnalysis({ ...result, stanzaSummary });
  restoreInlineInputFocus(focusSnapshot);
}

function setLineOverride(line, key, value) {
  const index = Number(line);
  if (!Number.isInteger(index) || index < 0) {
    return;
  }

  const current = state.lineOverrides[index] ?? {};
  state.lineOverrides[index] = {
    ...current,
    [key]: value
  };
}

function clearAutomaticSinalefaOverrides() {
  state.sinalefaOverrides = {};
  const cleanedLineOverrides = {};

  for (const [line, override] of Object.entries(state.lineOverrides)) {
    if (!override || typeof override !== 'object') {
      continue;
    }

    const { sinalefaOn, sinalefaOff, ...rest } = override;
    if (Object.keys(rest).length) {
      cleanedLineOverrides[line] = rest;
    }
  }

  state.lineOverrides = cleanedLineOverrides;
}

poemInput.value = SAMPLE_POEM;
poemInput.addEventListener('input', () => {
  updateAnalysis();
  scheduleAutoSave();
});

stressPreset.addEventListener('change', () => {
  if (stressPreset.value !== 'custom') {
    stressCustom.value = stressPreset.value;
  }
  updateAnalysis();
});

stressCustom.addEventListener('input', () => {
  stressPreset.value = 'custom';
  updateAnalysis();
});

hemistichSplit.addEventListener('input', updateAnalysis);
rhymeMode?.addEventListener('change', () => {
  syncRhymeSchemePreset();
  updateAnalysis();
});
rhymeScheme?.addEventListener('input', updateAnalysis);
analysisModeToggle?.addEventListener('click', () => {
  state.analysisMode = state.analysisMode === 'visual' ? 'text' : 'visual';
  applyAnalysisMode();
});
fontScaleControl?.addEventListener('input', () => {
  state.fontScale = clampFontScale(fontScaleControl.value);
  applyFontScale();
  saveUiPreferences();
});
fontSizeDown?.addEventListener('click', () => {
  adjustFontScale(-5);
});
fontSizeUp?.addEventListener('click', () => {
  adjustFontScale(5);
});
panelViewMode?.addEventListener('change', () => {
  state.panelViewMode = panelViewMode.value === 'writing' || panelViewMode.value === 'analysis'
    ? panelViewMode.value
    : 'both';
  applyPanelViewMode();
  saveUiPreferences();
});
openVersionManager?.addEventListener('click', () => {
  openVersionManagerModal();
});
savePoem?.addEventListener('click', () => {
  saveCurrentPoemVersion({ notify: true, notifyWhenUnchanged: true });
});
loadPoem?.addEventListener('click', loadSelectedPoemVersion);
importPoemsMd?.addEventListener('click', () => {
  importPoemsFile?.click();
});
importPoemsFile?.addEventListener('change', async () => {
  const file = importPoemsFile.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    importPoemsFromMarkdown(text);
  } finally {
    importPoemsFile.value = '';
  }
});
exportPoemsMd?.addEventListener('click', downloadMarkdownFile);
poemTitle?.addEventListener('input', () => {
  scheduleAutoSave();
});
savedPoemName?.addEventListener('change', () => {
  const targetTitle = savedPoemName.value;
  if (isCurrentDraftDirtyAgainstLoadedVersion()) {
    saveCurrentPoemVersion({ kind: 'manual' });
  }
  refreshSavedPoemNameOptions(targetTitle);
  savedPoemName.value = targetTitle;
  refreshSavedPoemVersionOptions(targetTitle);
  loadSelectedPoemVersion();
  syncSelectedVersionLabelInput();
});
savedPoemVersion?.addEventListener('change', () => {
  const targetTitle = savedPoemName?.value ?? '';
  const targetVersion = savedPoemVersion?.value ?? '';
  if (isCurrentDraftDirtyAgainstLoadedVersion()) {
    saveCurrentPoemVersion({ kind: 'manual' });
  }
  if (targetTitle) {
    refreshSavedPoemNameOptions(targetTitle);
    savedPoemName.value = targetTitle;
    refreshSavedPoemVersionOptions(targetTitle, targetVersion);
    if (savedPoemVersion && targetVersion) {
      savedPoemVersion.value = targetVersion;
    }
  }
  loadSelectedPoemVersion();
  syncSelectedVersionLabelInput();
});
editPoemVersionLabel?.addEventListener('click', () => {
  openVersionManagerModal({ focusLabel: true });
});
deletePoemVersion?.addEventListener('click', deleteSelectedPoemVersion);
deleteSelectedVersions?.addEventListener('click', deleteSelectedPoemVersions);
selectAllVersions?.addEventListener('click', () => {
  const checkboxes = savedVersionsList ? [...savedVersionsList.querySelectorAll('.saved-version-checkbox')] : [];
  const allIds = checkboxes
    .map((checkbox) => String(checkbox.value ?? ''))
    .filter(Boolean);

  if (!allIds.length) {
    return;
  }

  const allSelected = selectedVersionIds.size >= allIds.length;
  selectedVersionIds = allSelected ? new Set() : new Set(allIds);
  renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
});
applyVersionLabel?.addEventListener('click', updateSelectedVersionLabel);
versionLabelInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    updateSelectedVersionLabel();
  }
});
savedVersionsList?.addEventListener('change', (event) => {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement) || !checkbox.classList.contains('saved-version-checkbox')) {
    return;
  }

  const id = String(checkbox.value ?? '');
  if (!id) {
    return;
  }

  if (checkbox.checked) {
    selectedVersionIds.add(id);
  } else {
    selectedVersionIds.delete(id);
  }

  updateSelectAllButtonLabel((savedVersionsList?.querySelectorAll('.saved-version-checkbox').length) ?? 0);
});
closeVersionManager?.addEventListener('click', closeVersionManagerModal);
versionManagerModal?.addEventListener('click', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeModal === 'true') {
    closeVersionManagerModal();
  }
});
deletePoemEntry?.addEventListener('click', deleteSelectedPoemEntry);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && versionManagerModal?.classList.contains('is-open')) {
    closeVersionManagerModal();
  }

  if (!(event.ctrlKey || event.metaKey)) {
    return;
  }

  const key = String(event.key || '').toLowerCase();
  if (key === 's') {
    event.preventDefault();
    saveCurrentPoemVersion({ notify: true, notifyWhenUnchanged: true });
    return;
  }

  if (key === 'l' && event.shiftKey) {
    event.preventDefault();
    loadSelectedPoemVersion();
  }
});
sinalefaEnabled.addEventListener('click', () => {
  clearAutomaticSinalefaOverrides();
  updateAnalysis();
});

analysisOutput.addEventListener('click', (event) => {
  const target = event.target.closest('.sinalefa-toggle');
  if (!target || target.disabled) {
    return;
  }

  const line = Number(target.dataset.line);
  const boundary = Number(target.dataset.boundary);
  if (!Number.isInteger(line) || !Number.isInteger(boundary) || !lastRuntime?.[line]) {
    return;
  }

  const boundaryData = lastRuntime[line].activeBoundaries[boundary];
  if (!boundaryData || boundaryData.blockedByHemistich) {
    return;
  }

  const key = `${line}:${boundary}`;
  state.sinalefaOverrides[key] = !boundaryData.active;
  updateAnalysis();
});

analysisOutput.addEventListener('input', (event) => {
  const target = event.target?.closest?.('[data-role][data-line]') ?? event.target;
  const role = target.dataset.role;
  const line = target.dataset.line;

  if (!role || line === undefined) {
    return;
  }

  if (role === 'line-stress') {
    setLineOverride(line, 'stress', target.value);
  }

  if (role === 'line-hemi') {
    setLineOverride(line, 'hemistich', target.value);
  }

  if (role === 'line-rhyme') {
    setLineOverride(line, 'rhymeMode', target.value);
  }

  if (role === 'line-rhyme-text') {
    setLineOverride(line, 'rhymeText', target.value);
  }

  updateAnalysis();
});

analysisOutput.addEventListener('change', (event) => {
  const target = event.target?.closest?.('[data-role][data-line]') ?? event.target;
  const role = target.dataset.role;
  const line = target.dataset.line;

  if (!role || line === undefined) {
    return;
  }

  if (role === 'line-rhyme-text' || role === 'line-stress' || role === 'line-hemi') {
    if (role === 'line-stress') {
      setLineOverride(line, 'stress', target.value);
    }

    if (role === 'line-hemi') {
      setLineOverride(line, 'hemistich', target.value);
    }

    if (role === 'line-rhyme-text') {
      setLineOverride(line, 'rhymeText', target.value);
    }

    updateAnalysis();
  }
});

analysisOutput.addEventListener(
  'toggle',
  (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains('line-advanced')) {
      return;
    }

    const line = Number(details.dataset.line);
    if (!Number.isInteger(line)) {
      return;
    }

    state.openAdvancedByLine[line] = details.open;
  },
  true
);

updateAnalysis();
initializeUiPreferences();
refreshSavedPoemNameOptions(normalizePoemTitle(poemTitle?.value ?? ''));
applyAnalysisMode();
setPoemTitleDisplay(poemTitle?.value ?? '');

window.PoetryAnalyzer = {
  analyzePoem,
  analyzeWord,
  parseStressPattern,
  parseHemistichPositions
};
