/**
 * ============================================================================
 * PAGING TLB: HIT / MISS ANALYZER - CORE SIMULATION LOGIC (script.js)
 * Clean, Spacious, Educational Architecture Simulator
 * Second Year Computer Engineering Operating Systems Laboratory
 * ============================================================================
 */

'use strict';

/* --- 1. Global Constants, Timing & Simulation State --- */
const SIM_MODES = {
  TRADITIONAL: 'traditional',
  RESEARCH: 'research',
  COMPARE: 'compare'
};

// Fixed, deliberate classroom demonstration speed (approximately 4.2x to 4.5x slower than previous slow setting for lecture & viva explanations)
const SIMULATION_SPEED = {
  stepDelayMs: 6000,       // 6.0s pause between completed requests and after final PA output (previous slow was 1400ms -> 4.29x slower)
  stageDecomposeMs: 5000,  // 5.0s to clearly explain VA split into VPN and offset (previous slow was 1200ms -> 4.17x slower)
  stageLookupMs: 5000,     // 5.0s to explain parallel TLB cache probe and hit/miss outcome (previous slow was 1200ms -> 4.17x slower)
  stageMemoryWalkMs: 5800  // 5.8s on miss to explain DRAM Page Table lookup and TLB insertion/eviction (previous slow was 1300ms -> 4.46x slower)
};

const PRESETS = {
  normal: {
    pageSize: 100,
    tlbCapacity: 3,
    mappings: '0:5, 1:2, 2:7, 3:1, 4:9',
    sequence: '120, 380, 120, 250',
    description: 'Preset 1: Demonstrates standard TLB hits, misses, and page-table walks.'
  },
  coalesced: {
    pageSize: 100,
    tlbCapacity: 3,
    mappings: '10:20, 11:21, 12:22, 13:50, 14:51, 15:52',
    sequence: '1020, 1150, 1280, 1310, 1420',
    description: 'Preset 2: Consecutive mappings demonstrating block coalescing and prefetching.'
  }
};

const state = {
  mode: SIM_MODES.TRADITIONAL,
  pageSize: 100,
  tlbCapacity: 3,
  pageTable: new Map(),       // Map of VPN -> PFN
  coalescedBlocks: [],        // Array of { startVPN, startPFN, blockSize }
  addressSequence: [],
  currentStepIndex: 0,

  // Playback & Animation Engine
  isPlaying: false,
  playTimer: null,
  activeTimeouts: [],
  isPhaseAnimating: false,
  historyStack: [],

  // Traditional TLB State
  traditionalTLB: [],
  traditionalInsertCounter: 0,
  traditionalStats: { accesses: 0, hits: 0, misses: 0, demandWalks: 0, evictions: 0 },

  // Research-Inspired Coalesced TLB State (Parallel Arrays)
  researchTLB: {
    tlbStartPage: [],
    tlbStartFrame: [],
    tlbBlockSize: [],
    tlbInsertOrder: [],
    tlbIsPrefetched: []
  },
  researchInsertCounter: 0,
  researchStats: { accesses: 0, hits: 0, misses: 0, demandWalks: 0, prefetchWalks: 0, prefetchOps: 0, evictions: 0 }
};

/* --- 2. DOM Elements & Initialization --- */
let el = {};

function cacheDomElements() {
  const ids = [
    'btnModeTraditional', 'btnModeResearch', 'btnModeCompare',
    'presetNormal', 'presetCoalesced',
    'configForm', 'inputPageSize', 'inputTlbCapacity', 'inputPageTable', 'inputAddressSequence',
    'btnStartSim', 'validationAlertContainer', 'validationAlertMsg',
    'narrationBanner', 'narrationIcon', 'narrationPhaseBadge', 'narrationStepCounter', 'narrationText',
    'lookupOutcomeBadge', 'btnPrevStep', 'btnNextStep', 'btnPlayPause', 'playPauseIcon', 'playPauseText', 'btnRunAll', 'btnReset',
    'quickHitsCount', 'quickMissesCount', 'quickHitRate',
    'addressRibbon', 'sequenceStepCounter', 'singleSimulationView', 'compareSimulationView',
    'nodeVirtualAddress', 'nodeDecomposition', 'nodeTLB', 'nodePageTable', 'nodePhysicalAddress',
    'dispVirtualAddress', 'dispVPN', 'dispVpnFormula', 'dispOffset', 'dispOffsetFormula',
    'dispPFN', 'dispFinalOffset', 'dispPhysicalAddress', 'dispPaFormula',
    'tlbCapacityBadge', 'tlbVisualTable', 'tlbTableBody', 'thTlbKey', 'thTlbVal', 'thTlbExtra', 'tlbLookupMsg',
    'ptVisualTable', 'ptTableBody', 'ptWalkMsg', 'ptRefStatusBadge', 'memoryPtTableBody',
    'compareTradOutcome', 'compareTradTableBody', 'compareTradVA', 'compareTradVpnOff', 'compareTradPA',
    'compareTradHits', 'compareTradMisses', 'compareTradHitRate', 'compareTradWalks',
    'compareResearchOutcome', 'compareResearchTableBody', 'compareResearchVA', 'compareResearchBlock',
    'compareResearchPA', 'compareResearchHits', 'compareResearchMisses', 'compareResearchHitRate', 'compareResearchWalks',
    'pipelinePacketRailContainer', 'packetStageStatus', 'packetTrackFill', 'movingAddressPacket', 'packetIcon', 'packetDisplayVal',
    'compareTradPacketRailContainer', 'compareTradPacketStatus', 'compareTradTrackFill', 'compareTradPacket', 'compareTradPacketIcon', 'compareTradPacketVal',
    'compareResearchPacketRailContainer', 'compareResearchPacketStatus', 'compareResearchTrackFill', 'compareResearchPacket', 'compareResearchPacketIcon', 'compareResearchPacketVal'
  ];
  ids.forEach(id => { el[id] = document.getElementById(id); });
}

document.addEventListener('DOMContentLoaded', () => {
  cacheDomElements();
  registerEventListeners();
  loadPreset(PRESETS.normal);
});

function registerEventListeners() {
  if (el.btnModeTraditional) el.btnModeTraditional.addEventListener('click', () => switchMode(SIM_MODES.TRADITIONAL));
  if (el.btnModeResearch) el.btnModeResearch.addEventListener('click', () => switchMode(SIM_MODES.RESEARCH));
  if (el.btnModeCompare) el.btnModeCompare.addEventListener('click', () => switchMode(SIM_MODES.COMPARE));

  if (el.presetNormal) el.presetNormal.addEventListener('click', () => loadPreset(PRESETS.normal));
  if (el.presetCoalesced) el.presetCoalesced.addEventListener('click', () => loadPreset(PRESETS.coalesced));

  if (el.configForm) {
    el.configForm.addEventListener('submit', (e) => {
      e.preventDefault();
      startNewSimulation();
    });
  }

  if (el.btnStartSim) {
    el.btnStartSim.addEventListener('click', (e) => {
      e.preventDefault();
      startNewSimulation();
    });
  }

  if (el.btnPrevStep) {
    el.btnPrevStep.addEventListener('click', () => {
      pausePlay();
      executePreviousStep();
    });
  }

  if (el.btnNextStep) {
    el.btnNextStep.addEventListener('click', () => {
      pausePlay();
      if (state.isPhaseAnimating) {
        finishCurrentAddressInstantly();
        return;
      }
      if (!ensureLatestInputsApplied(true)) return;
      if (state.currentStepIndex >= state.addressSequence.length) {
        setNarration('Finished', 'All requested virtual addresses in sequence have been translated!', 'Review final statistics or click Reset.');
        setOutcomeBadge('COMPLETE', 'bg-info text-white');
        return;
      }
      executeNextStep(false);
    });
  }

  if (el.btnPlayPause) {
    el.btnPlayPause.addEventListener('click', togglePlayPause);
  }

  if (el.btnRunAll) {
    el.btnRunAll.addEventListener('click', executeRunAll);
  }

  if (el.btnReset) {
    el.btnReset.addEventListener('click', resetSimulation);
  }

  [el.inputPageSize, el.inputTlbCapacity, el.inputPageTable, el.inputAddressSequence].forEach(input => {
    if (input) {
      input.addEventListener('input', () => handleManualInputChange(false));
      input.addEventListener('change', () => handleManualInputChange(true));
      input.addEventListener('blur', () => handleManualInputChange(true));
    }
  });
}

/* --- 3. Timing & Scroll Management --- */
function clearActiveTimeouts() {
  state.activeTimeouts.forEach(t => clearTimeout(t));
  state.activeTimeouts = [];
}

function addTimeout(fn, ms) {
  const t = setTimeout(() => {
    const idx = state.activeTimeouts.indexOf(t);
    if (idx !== -1) state.activeTimeouts.splice(idx, 1);
    fn();
  }, ms);
  state.activeTimeouts.push(t);
  return t;
}

function clearAllTimers() {
  clearActiveTimeouts();
  if (state.playTimer) {
    clearTimeout(state.playTimer);
    state.playTimer = null;
  }
}

function ensurePipelineVisible() {
  const target = document.getElementById('sectionMainSimulation');
  if (!target) return;
  const header = document.querySelector('.app-header');
  const headerHeight = header ? header.getBoundingClientRect().height : 70;
  const rect = target.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;

  if (rect.top < (headerHeight + 5) || rect.top > (windowHeight * 0.40)) {
    const scrollTarget = window.pageYOffset + rect.top - headerHeight - 12;
    window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
  }
}

/* --- 4. Input Validation & Configuration --- */
function validateAndParseInputs(isSilent = false) {
  if (!isSilent) clearValidationError();

  const rawPageSize = String(el.inputPageSize?.value || '').trim();
  const rawTlbCapacity = String(el.inputTlbCapacity?.value || '').trim();
  const rawPageTable = String(el.inputPageTable?.value || '').trim();
  const rawSeq = String(el.inputAddressSequence?.value || '').trim();

  // Validate Page Size
  if (!/^\d+$/.test(rawPageSize) || parseInt(rawPageSize, 10) <= 0) {
    if (!isSilent) showValidationError('Page Size must be a positive integer (e.g. 100, 200, 4096).');
    return null;
  }
  const pageSize = parseInt(rawPageSize, 10);

  // Validate TLB Capacity
  if (!/^\d+$/.test(rawTlbCapacity) || parseInt(rawTlbCapacity, 10) <= 0 || parseInt(rawTlbCapacity, 10) > 16) {
    if (!isSilent) showValidationError('TLB Capacity must be a positive integer between 1 and 16 slots.');
    return null;
  }
  const tlbCapacity = parseInt(rawTlbCapacity, 10);

  // Validate Page Table Mappings
  if (!rawPageTable) {
    if (!isSilent) showValidationError('Please enter valid Page Table mappings (e.g. 0:5, 1:2, 2:7, 3:1, 4:9).');
    return null;
  }

  // Normalize delimiters: allow commas, semicolons, whitespace, colons with spaces, or arrows (->)
  let normMappings = rawPageTable.replace(/\s*(?:->|=>|=)\s*/g, ':');
  normMappings = normMappings.replace(/\s*:\s*/g, ':');
  const mappingTokens = normMappings.split(/[\s,;]+/).filter(Boolean);

  if (mappingTokens.length === 0) {
    if (!isSilent) showValidationError('At least one valid Page Table mapping must be provided.');
    return null;
  }

  const pageTable = new Map();
  for (const token of mappingTokens) {
    const parts = token.split(':');
    if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) {
      if (!isSilent) showValidationError(`Invalid mapping "${token}". Format each entry as VPN:PFN with non-negative integers (e.g. 0:5, 1:2).`);
      return null;
    }
    const vpn = parseInt(parts[0], 10);
    const pfn = parseInt(parts[1], 10);
    pageTable.set(vpn, pfn);
  }

  // Validate Virtual Address Sequence
  if (!rawSeq) {
    if (!isSilent) showValidationError('Please enter at least one valid numeric virtual address.');
    return null;
  }

  // Allow commas, semicolons, tabs, newlines, or whitespace as delimiters
  const addrTokens = rawSeq.split(/[\s,;]+/).filter(Boolean);
  if (addrTokens.length === 0) {
    if (!isSilent) showValidationError('Please enter at least one valid numeric virtual address.');
    return null;
  }

  const addressSequence = [];
  for (const token of addrTokens) {
    if (!/^\d+$/.test(token)) {
      if (!isSilent) showValidationError(`Invalid virtual address "${token}". Virtual addresses must be non-negative integers (e.g. 10, 110, 210).`);
      return null;
    }
    addressSequence.push(parseInt(token, 10));
  }

  if (!isSilent) clearValidationError();
  return { pageSize, tlbCapacity, pageTable, addressSequence };
}

function showValidationError(msg) {
  if (el.validationAlertContainer && el.validationAlertMsg) {
    el.validationAlertMsg.textContent = msg;
    el.validationAlertContainer.style.display = 'block';
  }
}

function clearValidationError() {
  if (el.validationAlertContainer) {
    el.validationAlertContainer.style.display = 'none';
  }
}

function isConfigDifferent(config) {
  if (!config) return false;
  if (state.pageSize !== config.pageSize) return true;
  if (state.tlbCapacity !== config.tlbCapacity) return true;
  if (state.addressSequence.length !== config.addressSequence.length) return true;
  for (let i = 0; i < state.addressSequence.length; i++) {
    if (state.addressSequence[i] !== config.addressSequence[i]) return true;
  }
  if (state.pageTable.size !== config.pageTable.size) return true;
  for (const [vpn, pfn] of config.pageTable.entries()) {
    if (state.pageTable.get(vpn) !== pfn) return true;
  }
  return false;
}

function handleManualInputChange(isExplicitCommit = false) {
  // Clear active highlight from preset buttons
  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));

  // Attempt to parse inputs
  const config = validateAndParseInputs(!isExplicitCommit);
  if (config) {
    clearValidationError();
    if (isConfigDifferent(config)) {
      pausePlay();
      clearAllTimers();
      applyConfiguration(config);
      setNarration('Ready', 'Custom inputs updated.', 'Click Next Step or Play to begin translation.');
      setOutcomeBadge('READY', 'bg-primary-subtle text-primary border border-primary-subtle');
    }
  }
}

function ensureLatestInputsApplied(showError = true) {
  const config = validateAndParseInputs(!showError);
  if (!config) return false;
  if (isConfigDifferent(config)) {
    pausePlay();
    clearAllTimers();
    applyConfiguration(config);
  }
  return true;
}

function applyConfiguration(config) {
  state.pageSize = config.pageSize;
  state.tlbCapacity = config.tlbCapacity;
  state.pageTable = config.pageTable;
  state.addressSequence = config.addressSequence;
  state.coalescedBlocks = identifyCoalescedBlocks(state.pageTable);
  initializeSimulationState();
}

function loadPreset(preset) {
  pausePlay();
  clearAllTimers();
  if (el.inputPageSize) el.inputPageSize.value = preset.pageSize;
  if (el.inputTlbCapacity) el.inputTlbCapacity.value = preset.tlbCapacity;
  if (el.inputPageTable) el.inputPageTable.value = preset.mappings;
  if (el.inputAddressSequence) el.inputAddressSequence.value = preset.sequence;

  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  if (preset === PRESETS.normal && el.presetNormal) el.presetNormal.classList.add('active');
  if (preset === PRESETS.coalesced && el.presetCoalesced) el.presetCoalesced.classList.add('active');

  const config = validateAndParseInputs(false);
  if (config) {
    applyConfiguration(config);
    setNarration('Ready', `Loaded ${preset === PRESETS.normal ? 'Preset 1: Normal TLB' : 'Preset 2: Coalesced TLB'}.`, preset.description);
    setOutcomeBadge('STANDBY', 'bg-light text-secondary border');
  }
}

function startNewSimulation() {
  pausePlay();
  clearAllTimers();
  const config = validateAndParseInputs(false);
  if (!config) return false;

  applyConfiguration(config);
  setNarration('Ready', 'New simulation initialized with custom inputs.', 'Click Next Step or Play to begin.');
  setOutcomeBadge('READY', 'bg-primary-subtle text-primary border border-primary-subtle');
  ensurePipelineVisible();
  return true;
}

function initializeSimulationState() {
  state.currentStepIndex = 0;
  state.isPhaseAnimating = false;
  state.currentExecution = null;
  state.historyStack = [];

  state.traditionalTLB = [];
  state.traditionalInsertCounter = 0;
  state.traditionalStats = { accesses: 0, hits: 0, misses: 0, demandWalks: 0, evictions: 0 };

  state.researchTLB = {
    tlbStartPage: [],
    tlbStartFrame: [],
    tlbBlockSize: [],
    tlbInsertOrder: [],
    tlbIsPrefetched: []
  };
  state.researchInsertCounter = 0;
  state.researchStats = { accesses: 0, hits: 0, misses: 0, demandWalks: 0, prefetchWalks: 0, prefetchOps: 0, evictions: 0 };

  updateUI();
  resetPipelineDisplays();
}

/* --- 5. Mathematical Translation Helpers --- */
function calculateAddressDecomposition(va, pageSize) {
  return { vpn: Math.floor(va / pageSize), offset: va % pageSize };
}

function calculatePhysicalAddress(pfn, pageSize, offset) {
  return (pfn * pageSize) + offset;
}

function identifyCoalescedBlocks(pageTableMap) {
  const vpns = Array.from(pageTableMap.keys()).sort((a, b) => a - b);
  const blocks = [];
  let i = 0;

  while (i < vpns.length) {
    const startVPN = vpns[i];
    const startPFN = pageTableMap.get(startVPN);
    let blockSize = 1;

    while (i + 1 < vpns.length) {
      const nextVPN = vpns[i + 1];
      const nextPFN = pageTableMap.get(nextVPN);
      if (nextVPN === startVPN + blockSize && nextPFN === startPFN + blockSize) {
        blockSize++;
        i++;
      } else {
        break;
      }
    }
    blocks.push({ startVPN, startPFN, blockSize });
    i++;
  }
  return blocks;
}

function findCoalescedBlockForVPN(vpn, blocks) {
  for (const b of blocks) {
    if (vpn >= b.startVPN && vpn < (b.startVPN + b.blockSize)) return b;
  }
  return null;
}

function findNextContiguousBlockInPageTable(nextStartVPN, blocks) {
  for (const b of blocks) {
    if (b.startVPN === nextStartVPN) return b;
  }
  return null;
}

/* --- 6. TLB Cache Operations --- */
function searchTraditionalTLB(vpn) {
  for (let i = 0; i < state.traditionalTLB.length; i++) {
    const entry = state.traditionalTLB[i];
    if (entry && entry.vpn === vpn) {
      return { hit: true, slotIndex: i, entry };
    }
  }
  return { hit: false, slotIndex: -1, entry: null };
}

function insertTraditionalTLB(vpn, pfn) {
  state.traditionalInsertCounter++;
  const newEntry = { vpn, pfn, insertOrder: state.traditionalInsertCounter, slotIndex: 0 };

  if (state.traditionalTLB.length < state.tlbCapacity) {
    newEntry.slotIndex = state.traditionalTLB.length;
    state.traditionalTLB.push(newEntry);
    return { evicted: null, inserted: newEntry };
  }

  // FIFO Eviction
  let oldestIndex = 0;
  let minOrder = state.traditionalTLB[0].insertOrder;
  for (let i = 1; i < state.traditionalTLB.length; i++) {
    if (state.traditionalTLB[i].insertOrder < minOrder) {
      minOrder = state.traditionalTLB[i].insertOrder;
      oldestIndex = i;
    }
  }

  const evicted = state.traditionalTLB[oldestIndex];
  state.traditionalStats.evictions++;
  newEntry.slotIndex = oldestIndex;
  state.traditionalTLB[oldestIndex] = newEntry;
  return { evicted, inserted: newEntry };
}

function searchResearchTLB(vpn) {
  const { tlbStartPage, tlbStartFrame, tlbBlockSize } = state.researchTLB;
  for (let i = 0; i < tlbStartPage.length; i++) {
    const start = tlbStartPage[i];
    const size = tlbBlockSize[i];
    if (vpn >= start && vpn < (start + size)) {
      const pfn = tlbStartFrame[i] + (vpn - start);
      return { hit: true, slotIndex: i, pfn, startVPN: start, blockSize: size };
    }
  }
  return { hit: false, slotIndex: -1, pfn: null, startVPN: null, blockSize: 0 };
}

function isBlockInResearchTLB(targetVPN) {
  const { tlbStartPage, tlbBlockSize } = state.researchTLB;
  for (let i = 0; i < tlbStartPage.length; i++) {
    if (targetVPN >= tlbStartPage[i] && targetVPN < (tlbStartPage[i] + tlbBlockSize[i])) return true;
  }
  return false;
}

function insertResearchTLB(block, isPrefetch = false) {
  const tlb = state.researchTLB;
  state.researchInsertCounter++;

  if (tlb.tlbStartPage.length < state.tlbCapacity) {
    const slot = tlb.tlbStartPage.length;
    tlb.tlbStartPage.push(block.startVPN);
    tlb.tlbStartFrame.push(block.startPFN);
    tlb.tlbBlockSize.push(block.blockSize);
    tlb.tlbInsertOrder.push(state.researchInsertCounter);
    tlb.tlbIsPrefetched.push(isPrefetch);
    return { evictedSlot: -1, insertedSlot: slot };
  }

  // FIFO Eviction
  let oldestSlot = 0;
  let minOrder = tlb.tlbInsertOrder[0];
  for (let i = 1; i < tlb.tlbInsertOrder.length; i++) {
    if (tlb.tlbInsertOrder[i] < minOrder) {
      minOrder = tlb.tlbInsertOrder[i];
      oldestSlot = i;
    }
  }

  state.researchStats.evictions++;
  tlb.tlbStartPage[oldestSlot] = block.startVPN;
  tlb.tlbStartFrame[oldestSlot] = block.startPFN;
  tlb.tlbBlockSize[oldestSlot] = block.blockSize;
  tlb.tlbInsertOrder[oldestSlot] = state.researchInsertCounter;
  tlb.tlbIsPrefetched[oldestSlot] = isPrefetch;
  return { evictedSlot: oldestSlot, insertedSlot: oldestSlot };
}

/* --- 7. History Snapshot & Previous Step (Rewind) --- */
function saveStateSnapshot() {
  state.historyStack.push({
    currentStepIndex: state.currentStepIndex,
    traditionalTLB: JSON.parse(JSON.stringify(state.traditionalTLB)),
    traditionalInsertCounter: state.traditionalInsertCounter,
    traditionalStats: { ...state.traditionalStats },
    researchTLB: {
      tlbStartPage: [...state.researchTLB.tlbStartPage],
      tlbStartFrame: [...state.researchTLB.tlbStartFrame],
      tlbBlockSize: [...state.researchTLB.tlbBlockSize],
      tlbInsertOrder: [...state.researchTLB.tlbInsertOrder],
      tlbIsPrefetched: [...state.researchTLB.tlbIsPrefetched]
    },
    researchInsertCounter: state.researchInsertCounter,
    researchStats: { ...state.researchStats }
  });
}

function executePreviousStep() {
  if (state.historyStack.length === 0) return;
  clearAllTimers();
  state.isPhaseAnimating = false;
  state.currentExecution = null;

  const snap = state.historyStack.pop();
  state.currentStepIndex = snap.currentStepIndex;
  state.traditionalTLB = snap.traditionalTLB;
  state.traditionalInsertCounter = snap.traditionalInsertCounter;
  state.traditionalStats = snap.traditionalStats;
  state.researchTLB = snap.researchTLB;
  state.researchInsertCounter = snap.researchInsertCounter;
  state.researchStats = snap.researchStats;

  updateUI();
  resetPipelineDisplays();

  const chips = el.addressRibbon?.querySelectorAll('.addr-chip');
  if (chips) {
    chips.forEach((c, idx) => {
      c.className = 'addr-chip';
      if (idx < state.currentStepIndex) c.classList.add('hit');
      else if (idx === state.currentStepIndex) c.classList.add('active');
      else c.classList.add('pending');
    });
  }

  if (state.currentStepIndex < state.addressSequence.length) {
    const nextVA = state.addressSequence[state.currentStepIndex];
    if (el.narrationStepCounter) {
      el.narrationStepCounter.textContent = `Step ${state.currentStepIndex + 1} of ${state.addressSequence.length} (VA: ${nextVA})`;
    }
    setNarration('Ready', `Rewound to Step ${state.currentStepIndex + 1} (Virtual Address ${nextVA}).`, 'Click Next Step or Play to translate.');
  } else {
    if (el.narrationStepCounter) {
      el.narrationStepCounter.textContent = `Step 0 of ${state.addressSequence.length}`;
    }
    setNarration('Ready', 'Rewound to the start of the simulation.', 'Click Next Step or Play to begin.');
  }
  setOutcomeBadge('READY', 'bg-primary-subtle text-primary border border-primary-subtle');
  ensurePipelineVisible();
}

/* --- 8. Core Translation Logic & Synchronized Step Engine --- */
function executeTraditionalTranslation(vpn, offset) {
  state.traditionalStats.accesses++;
  const lookup = searchTraditionalTLB(vpn);

  if (lookup.hit) {
    state.traditionalStats.hits++;
    const pfn = lookup.entry.pfn;
    const pa = calculatePhysicalAddress(pfn, state.pageSize, offset);
    return { hit: true, pfn, pa, slotIndex: lookup.slotIndex, evicted: null, isFault: false };
  }

  state.traditionalStats.misses++;
  state.traditionalStats.demandWalks++;

  if (state.pageTable.has(vpn)) {
    const pfn = state.pageTable.get(vpn);
    const pa = calculatePhysicalAddress(pfn, state.pageSize, offset);
    const { evicted, inserted } = insertTraditionalTLB(vpn, pfn);
    return { hit: false, pfn, pa, slotIndex: inserted.slotIndex, evicted, isFault: false };
  }

  return { hit: false, pfn: null, pa: null, slotIndex: -1, evicted: null, isFault: true };
}

function executeResearchTranslation(vpn, offset) {
  state.researchStats.accesses++;
  const lookup = searchResearchTLB(vpn);

  if (lookup.hit) {
    state.researchStats.hits++;
    const pfn = lookup.pfn;
    const pa = calculatePhysicalAddress(pfn, state.pageSize, offset);
    let prefetchBlock = null;

    const nextStartVPN = lookup.startVPN + lookup.blockSize;
    if (!isBlockInResearchTLB(nextStartVPN)) {
      const nextBlock = findNextContiguousBlockInPageTable(nextStartVPN, state.coalescedBlocks);
      if (nextBlock) {
        state.researchStats.prefetchWalks++;
        state.researchStats.prefetchOps++;
        insertResearchTLB(nextBlock, true);
        prefetchBlock = nextBlock;
      }
    }

    return {
      hit: true,
      pfn,
      pa,
      slotIndex: lookup.slotIndex,
      blockRange: `[${lookup.startVPN}..${lookup.startVPN + lookup.blockSize - 1}]`,
      prefetchBlock,
      isFault: false
    };
  }

  state.researchStats.misses++;
  state.researchStats.demandWalks++;

  const block = findCoalescedBlockForVPN(vpn, state.coalescedBlocks);
  if (block) {
    const pfn = block.startPFN + (vpn - block.startVPN);
    const pa = calculatePhysicalAddress(pfn, state.pageSize, offset);
    const { insertedSlot } = insertResearchTLB(block, false);
    return {
      hit: false,
      pfn,
      pa,
      slotIndex: insertedSlot,
      blockRange: `[${block.startVPN}..${block.startVPN + block.blockSize - 1}]`,
      prefetchBlock: null,
      isFault: false
    };
  }

  return { hit: false, pfn: null, pa: null, slotIndex: -1, blockRange: 'None', prefetchBlock: null, isFault: true };
}

/**
 * Helper to update the 2D animated address packet and track status.
 */
function updatePacketPosition(stageNum, text, stateClass = '', statusLabel = '') {
  if (!el.movingAddressPacket) return;
  const positions = { 1: '0%', 2: '33%', 3: '66%', 4: '100%' };
  const pos = positions[stageNum] || '0%';

  el.movingAddressPacket.style.left = pos;
  if (el.packetTrackFill) el.packetTrackFill.style.width = pos;
  if (el.packetDisplayVal) el.packetDisplayVal.textContent = text;
  if (el.packetStageStatus && statusLabel) el.packetStageStatus.textContent = statusLabel;

  el.movingAddressPacket.classList.remove('packet-hit', 'packet-miss', 'packet-prefetch');
  if (stateClass) el.movingAddressPacket.classList.add(stateClass);

  if (el.packetIcon) {
    if (stateClass === 'packet-hit') el.packetIcon.className = 'bi bi-check-circle-fill me-1 text-success';
    else if (stateClass === 'packet-miss') el.packetIcon.className = 'bi bi-x-circle-fill me-1 text-danger';
    else if (stateClass === 'packet-prefetch') el.packetIcon.className = 'bi bi-stars me-1 text-purple';
    else el.packetIcon.className = 'bi bi-box-seam me-1 text-primary';
  }

  // Highlight active stage card, dim the others
  const nodes = [el.nodeVirtualAddress, el.nodeDecomposition, el.nodeTLB, el.nodePhysicalAddress];
  nodes.forEach((n, idx) => {
    if (n) {
      if (idx + 1 === stageNum) {
        n.classList.remove('pipeline-dimmed');
      } else {
        n.classList.add('pipeline-dimmed');
      }
    }
  });
}

/**
 * Helper to update the 2D animated address packets and track statuses for Compare Both mode.
 */
function updateComparisonPacketPositions(stageNum, tradText = '', tradClass = '', tradStatus = '', resText = '', resClass = '', resStatus = '') {
  const positions = { 1: '0%', 2: '33%', 3: '66%', 4: '100%' };
  const pos = positions[stageNum] || '0%';

  // Traditional TLB Hardware Track
  if (el.compareTradPacket) {
    el.compareTradPacket.style.left = pos;
    if (el.compareTradTrackFill) el.compareTradTrackFill.style.width = pos;
    if (el.compareTradPacketVal && tradText) el.compareTradPacketVal.textContent = tradText;
    if (el.compareTradPacketStatus && tradStatus) el.compareTradPacketStatus.textContent = tradStatus;

    el.compareTradPacket.classList.remove('packet-hit', 'packet-miss', 'packet-prefetch');
    if (tradClass) el.compareTradPacket.classList.add(tradClass);

    if (el.compareTradPacketIcon) {
      if (tradClass === 'packet-hit') el.compareTradPacketIcon.className = 'bi bi-check-circle-fill me-1 text-success';
      else if (tradClass === 'packet-miss') el.compareTradPacketIcon.className = 'bi bi-x-circle-fill me-1 text-danger';
      else el.compareTradPacketIcon.className = 'bi bi-box-seam me-1 text-primary';
    }
  }

  // Research Coalesced TLB Hardware Track
  if (el.compareResearchPacket) {
    el.compareResearchPacket.style.left = pos;
    if (el.compareResearchTrackFill) el.compareResearchTrackFill.style.width = pos;
    if (el.compareResearchPacketVal && resText) el.compareResearchPacketVal.textContent = resText;
    if (el.compareResearchPacketStatus && resStatus) el.compareResearchPacketStatus.textContent = resStatus;

    el.compareResearchPacket.classList.remove('packet-hit', 'packet-miss', 'packet-prefetch');
    if (resClass) el.compareResearchPacket.classList.add(resClass);

    if (el.compareResearchPacketIcon) {
      if (resClass === 'packet-hit') el.compareResearchPacketIcon.className = 'bi bi-check-circle-fill me-1 text-success';
      else if (resClass === 'packet-miss') el.compareResearchPacketIcon.className = 'bi bi-x-circle-fill me-1 text-danger';
      else if (resClass === 'packet-prefetch') el.compareResearchPacketIcon.className = 'bi bi-stars me-1 text-purple';
      else el.compareResearchPacketIcon.className = 'bi bi-box-seam me-1 text-purple';
    }
  }
}

/**
 * Main stepping execution function.
 * Called once per virtual address request.
 * Authoritative translation is calculated once at start of step to prevent double-counting.
 */
function executeNextStep(isInstant = false) {
  if (state.currentStepIndex >= state.addressSequence.length) {
    pausePlay();
    setNarration('Finished', 'All requested virtual addresses in sequence have been translated!', 'Review final statistics or click Reset.');
    setOutcomeBadge('COMPLETE', 'bg-info text-white');
    return;
  }

  saveStateSnapshot();
  state.isPhaseAnimating = true;

  const currentVA = state.addressSequence[state.currentStepIndex];
  const stepNumber = state.currentStepIndex + 1;
  const totalSteps = state.addressSequence.length;
  const decomp = calculateAddressDecomposition(currentVA, state.pageSize);
  const { vpn, offset } = decomp;

  // Authoritatively compute simulation outcomes EXACTLY ONCE per demand request
  let tradRes = null;
  let resRes = null;

  if (state.mode === SIM_MODES.COMPARE) {
    tradRes = executeTraditionalTranslation(vpn, offset);
    resRes = executeResearchTranslation(vpn, offset);
  } else if (state.mode === SIM_MODES.RESEARCH) {
    resRes = executeResearchTranslation(vpn, offset);
  } else {
    tradRes = executeTraditionalTranslation(vpn, offset);
  }

  state.currentExecution = {
    va: currentVA,
    decomp,
    tradRes,
    resRes
  };

  ensurePipelineVisible();
  if (el.narrationStepCounter) {
    el.narrationStepCounter.textContent = `Step ${stepNumber} of ${totalSteps} (VA: ${currentVA})`;
  }
  updateAddressRibbon(state.currentStepIndex);

  if (isInstant) {
    applyInstantStepVisuals(state.currentExecution);
    finishStep();
    return;
  }

  clearPipelineHighlightStates();
  if (state.mode === SIM_MODES.COMPARE) {
    animateComparisonStep(state.currentExecution);
  } else {
    animateSingleStep(state.mode, state.currentExecution);
  }
}

/**
 * Applies instant visual updates for Run All or Fast-forward without animation delays.
 */
function applyInstantStepVisuals(execution) {
  const { va, decomp, tradRes, resRes } = execution;
  const { vpn, offset } = decomp;

  clearPipelineHighlightStates();

  if (state.mode === SIM_MODES.COMPARE) {
    const tradOutcomeText = tradRes.hit ? 'HIT' : (tradRes.isFault ? 'FAULT' : 'MISS (Walk)');
    const resOutcomeText = resRes.hit ? 'HIT' : (resRes.isFault ? 'FAULT' : 'MISS (Walk)');
    const tradPAText = tradRes.pa !== null ? tradRes.pa.toString() : 'UNMAPPED';
    const resPAText = resRes.pa !== null ? resRes.pa.toString() : 'UNMAPPED';
    const resBlockText = resRes.blockRange || 'None';

    renderComparisonViews(va, vpn, offset, tradOutcomeText, tradPAText, resOutcomeText, resPAText, resBlockText);
    markAddressChip(state.currentStepIndex, (tradRes.hit || resRes.hit) ? 'hit' : 'miss');

    updateComparisonPacketPositions(
      4,
      tradRes.pa !== null ? `PA ${tradRes.pa}` : 'FAULT',
      tradRes.hit ? 'packet-hit' : 'packet-miss',
      `Complete: ${tradOutcomeText} (PA ${tradPAText})`,
      resRes.pa !== null ? `PA ${resRes.pa}` : 'FAULT',
      resRes.hit ? 'packet-hit' : (resRes.prefetchBlock ? 'packet-prefetch' : 'packet-miss'),
      `Complete: ${resOutcomeText} (PA ${resPAText})`
    );
    return;
  }

  const isTrad = (state.mode === SIM_MODES.TRADITIONAL);
  const res = isTrad ? tradRes : resRes;

  renderStage1And2(va, decomp);

  if (res.hit) {
    setNodeState(el.nodeTLB, 'state-hit');
    setOutcomeBadge(isTrad ? 'TLB HIT' : 'COALESCED HIT', 'bg-success text-white');
    renderPhysicalAddress(res.pfn, offset, res.pa);
    markAddressChip(state.currentStepIndex, 'hit');
    updatePacketPosition(4, `PA ${res.pa}`, 'packet-hit', `Complete: TLB HIT (PA ${res.pa})`);
  } else {
    setNodeState(el.nodeTLB, 'state-miss');
    if (res.isFault) {
      setOutcomeBadge('PAGE FAULT', 'bg-danger text-white');
      renderUnmappedAddress();
      updatePacketPosition(4, 'PAGE FAULT', 'packet-miss', 'Complete: Page Fault (Unmapped Page)');
    } else {
      setOutcomeBadge('TLB MISS', 'bg-danger text-white');
      renderPhysicalAddress(res.pfn, offset, res.pa);
      updatePacketPosition(4, `PA ${res.pa}`, 'packet-miss', `Complete: TLB MISS & DRAM Walk (PA ${res.pa})`);
    }
    markAddressChip(state.currentStepIndex, 'miss');
  }

  if (isTrad) renderTraditionalTLBTable();
  else renderResearchTLBTable();

  // Remove dimming after instant completion
  [el.nodeVirtualAddress, el.nodeDecomposition, el.nodeTLB, el.nodePhysicalAddress].forEach(n => {
    if (n) n.classList.remove('pipeline-dimmed');
  });
}

/**
 * 2D Animated Single-Engine Progression:
 * Travels through Stage 1 -> Stage 2 -> Stage 3 -> (DRAM Walk on miss) -> Stage 4.
 */
function animateSingleStep(mode, execution) {
  const { va, decomp, tradRes, resRes } = execution;
  const { vpn, offset } = decomp;
  const isTrad = (mode === SIM_MODES.TRADITIONAL);
  const res = isTrad ? tradRes : resRes;

  // --- Phase 1: Virtual Address Arrival (Stage 1) ---
  setNodeState(el.nodeVirtualAddress, 'state-active');
  setText(el.dispVirtualAddress, va);
  updatePacketPosition(1, `VA ${va}`, '', `Stage 1: CPU Request (VA ${va})`);
  setNarration('Stage 1: CPU Request', `CPU requests memory access at Virtual Address ${va}.`, 'This virtual address must be translated to find the physical RAM location.');

  // --- Phase 2: Address Decomposition (Stage 2) ---
  addTimeout(() => {
    setNodeState(el.nodeDecomposition, 'state-active');
    setText(el.dispVPN, vpn);
    setText(el.dispVpnFormula, `\u230a${va} / ${state.pageSize}\u230b = ${vpn}`);
    setText(el.dispOffset, offset);
    setText(el.dispOffsetFormula, `${va} % ${state.pageSize} = ${offset}`);

    updatePacketPosition(2, `VPN ${vpn} | Off ${offset}`, '', `Stage 2: Split (VPN ${vpn}, Offset ${offset})`);
    setNarration('Stage 2: Split Address', `Virtual Address ${va} is split into VPN ${vpn} and Offset ${offset}.`, `VPN = \u230a${va} / ${state.pageSize}\u230b = ${vpn}. Offset = ${va} % ${state.pageSize} = ${offset}.`);

    // --- Phase 3: Hardware TLB Cache Lookup (Stage 3) ---
    addTimeout(() => {
      setNodeState(el.nodeTLB, 'state-active');
      triggerTLBSearchScan();
      updatePacketPosition(3, `Probing TLB...`, '', `Stage 3: TLB Lookup (VPN ${vpn})`);
      setNarration('Stage 3: TLB Lookup', `Searching the ${isTrad ? 'hardware TLB cache' : 'Coalesced TLB'} for VPN ${vpn}...`, isTrad ? 'The hardware checks all TLB slots in parallel in 1 cycle.' : 'The hardware checks all cached range entries in parallel in 1 cycle.');

      addTimeout(() => {
        if (res.hit) {
          setNodeState(el.nodeTLB, 'state-hit');
          setOutcomeBadge(isTrad ? 'TLB HIT' : 'COALESCED HIT', 'bg-success text-white');
          highlightTLBRow(res.slotIndex, 'row-hit');
          markAddressChip(state.currentStepIndex, 'hit');
          updatePacketPosition(3, isTrad ? `HIT (Slot #${res.slotIndex})` : `HIT [${res.blockRange}]`, 'packet-hit', isTrad ? `TLB Hit: Found in Slot #${res.slotIndex}` : `TLB Hit: Matched Range ${res.blockRange}`);

          if (!isTrad) renderResearchTLBTable();

          if (!isTrad && res.prefetchBlock) {
            setNodeState(el.nodePageTable, 'state-prefetch');
            highlightPageTableRow(res.prefetchBlock.startVPN, 'row-prefetch-active');
            setNarration('TLB Hit & Prefetch', `VPN ${vpn} is inside the cached range ${res.blockRange}. TLB Hit.`, `Prefetch loaded the next consecutive block [${res.prefetchBlock.startVPN}..${res.prefetchBlock.startVPN + res.prefetchBlock.blockSize - 1}] from memory ahead of demand!`);
          } else {
            setNarration(
              isTrad ? 'TLB Hit' : 'Coalesced Hit',
              isTrad ? `VPN ${vpn} found in TLB Slot #${res.slotIndex} \u2192 Frame ${res.pfn}. TLB Hit.` : `VPN ${vpn} is inside the cached range ${res.blockRange}. TLB Hit.`,
              `Physical Address = (${res.pfn} \u00d7 ${state.pageSize}) + ${offset} = ${res.pa}. Fast 1-cycle access without page table walk.`
            );
          }

          // Advance to Stage 4 (Physical Address Output)
          addTimeout(() => {
            renderPhysicalAddress(res.pfn, offset, res.pa);
            updatePacketPosition(4, `PA ${res.pa}`, 'packet-hit', `Stage 4: Physical Address (PA ${res.pa})`);
            addTimeout(finishStep, SIMULATION_SPEED.stepDelayMs);
          }, SIMULATION_SPEED.stageDecomposeMs);

        } else {
          // TLB MISS
          setNodeState(el.nodeTLB, 'state-miss');
          setOutcomeBadge('TLB MISS', 'bg-danger text-white');
          markAddressChip(state.currentStepIndex, 'miss');
          updatePacketPosition(3, 'TLB MISS', 'packet-miss', `Stage 3: TLB Miss (VPN ${vpn} not in cache)`);

          if (res.isFault) {
            setOutcomeBadge('PAGE FAULT', 'bg-danger text-white');
            renderUnmappedAddress();
            updatePacketPosition(4, 'PAGE FAULT', 'packet-miss', 'Stage 4: Page Fault (Unmapped Page)');
            setNarration('Page Fault', `Page Fault! VPN ${vpn} is not mapped in the page table.`, 'The operating system must allocate a physical frame and load the page.');
            addTimeout(finishStep, SIMULATION_SPEED.stepDelayMs);
          } else {
            // DRAM Page Table Walk
            setNodeState(el.nodePageTable, 'state-miss');
            highlightPageTableRow(vpn, 'row-walk-active');
            setNarration('TLB Miss', `TLB Miss. The simulator checks the page table to find the physical frame.`, `Page table retrieved mapping: VPN ${vpn} \u2192 Frame ${res.pfn}. Inserting entry into TLB.`);

            addTimeout(() => {
              if (isTrad) renderTraditionalTLBTable();
              else renderResearchTLBTable();
              highlightTLBRow(res.slotIndex, 'row-inserted');
              const evictionText = res.evicted
                ? `The TLB is full. FIFO removes the oldest entry (VPN ${res.evicted.vpn}).`
                : 'Stored mapping in available TLB slot.';
              setNarration('TLB Updated', `Frame ${res.pfn} cached into Slot #${res.slotIndex}.`, evictionText);

              // Advance to Stage 4 (Physical Address Output)
              addTimeout(() => {
                renderPhysicalAddress(res.pfn, offset, res.pa);
                updatePacketPosition(4, `PA ${res.pa}`, 'packet-miss', `Stage 4: Physical Address (PA ${res.pa})`);
                addTimeout(finishStep, SIMULATION_SPEED.stepDelayMs);
              }, SIMULATION_SPEED.stageDecomposeMs);

            }, SIMULATION_SPEED.stageMemoryWalkMs);
          }
        }
      }, SIMULATION_SPEED.stageLookupMs);
    }, SIMULATION_SPEED.stageDecomposeMs);
  }, SIMULATION_SPEED.stageDecomposeMs);
}

/**
 * Comparison Mode Animated Step:
 * Both algorithms evaluate the EXACT SAME address sequence in original order.
 * Shows synchronized side-by-side data-path tracks for Traditional and Coalesced TLBs.
 */
function animateComparisonStep(execution) {
  const { va, decomp, tradRes, resRes } = execution;
  const { vpn, offset } = decomp;

  // Stage 1: CPU Request (VA enters both hardware tracks)
  if (el.compareTradVA) el.compareTradVA.textContent = va;
  if (el.compareTradVpnOff) el.compareTradVpnOff.textContent = '--';
  if (el.compareTradPA) el.compareTradPA.textContent = '--';
  if (el.compareTradOutcome) {
    el.compareTradOutcome.textContent = 'Standby';
    el.compareTradOutcome.className = 'badge bg-light text-primary border font-monospace';
  }

  if (el.compareResearchVA) el.compareResearchVA.textContent = va;
  if (el.compareResearchBlock) el.compareResearchBlock.textContent = '--';
  if (el.compareResearchPA) el.compareResearchPA.textContent = '--';
  if (el.compareResearchOutcome) {
    el.compareResearchOutcome.textContent = 'Standby';
    el.compareResearchOutcome.className = 'badge bg-light text-purple border font-monospace';
  }

  updateComparisonPacketPositions(
    1,
    `VA ${va}`, '', `Stage 1: CPU Request (VA ${va})`,
    `VA ${va}`, '', `Stage 1: CPU Request (VA ${va})`
  );

  setNarration(
    'Stage 1: CPU Request',
    `CPU requests memory access at Virtual Address ${va}.`,
    'Both Traditional TLB and Coalesced TLB receive the exact same address request.'
  );

  // Stage 2: Address Split
  addTimeout(() => {
    if (el.compareTradVpnOff) el.compareTradVpnOff.textContent = `VPN ${vpn} | Offset ${offset}`;
    updateComparisonPacketPositions(
      2,
      `VPN ${vpn} | Off ${offset}`, '', `Stage 2: Split (VPN ${vpn}, Offset ${offset})`,
      `VPN ${vpn} | Off ${offset}`, '', `Stage 2: Split (VPN ${vpn}, Offset ${offset})`
    );

    setNarration(
      'Stage 2: Split Address',
      `Virtual Address ${va} is split into VPN ${vpn} and Offset ${offset}.`,
      `VPN = \u230a${va} / ${state.pageSize}\u230b = ${vpn}. Offset = ${va} % ${state.pageSize} = ${offset}.`
    );

    // Stage 3: TLB & Range Probe
    addTimeout(() => {
      updateComparisonPacketPositions(
        3,
        'Probing TLB...', '', `Stage 3: Checking TLB slots (VPN ${vpn})`,
        'Probing Ranges...', '', `Stage 3: Checking range entries (VPN ${vpn})`
      );

      if (el.compareTradOutcome) el.compareTradOutcome.textContent = 'Probing...';
      if (el.compareResearchOutcome) el.compareResearchOutcome.textContent = 'Probing...';

      setNarration(
        'Stage 3: TLB Lookup',
        `Both engines search their TLB cache for VPN ${vpn} in parallel.`,
        'Traditional checks individual page slots; Coalesced checks range entries.'
      );

      // Stage 3 Outcome (Hit / Miss & Memory Walk)
      addTimeout(() => {
        const tradOutcomeText = tradRes.hit ? 'HIT' : (tradRes.isFault ? 'FAULT' : 'MISS (Walk)');
        const resOutcomeText = resRes.hit ? 'HIT' : (resRes.isFault ? 'FAULT' : 'MISS (Walk)');
        const tradClass = tradRes.hit ? 'packet-hit' : 'packet-miss';
        const resClass = resRes.hit ? 'packet-hit' : (resRes.prefetchBlock ? 'packet-prefetch' : 'packet-miss');

        const tradStatus = tradRes.hit ? `TLB Hit: Slot #${tradRes.slotIndex}` : (tradRes.isFault ? 'Page Fault: Unmapped' : `TLB Miss: Checked page table \u2192 Frame ${tradRes.pfn}`);
        const resStatus = resRes.hit ? `Coalesced Hit: Range ${resRes.blockRange}` : (resRes.isFault ? 'Page Fault: Unmapped' : `TLB Miss: Loaded range ${resRes.blockRange}`);

        updateComparisonPacketPositions(
          3,
          tradRes.hit ? `HIT (#${tradRes.slotIndex})` : (tradRes.isFault ? 'FAULT' : 'MISS (Walk PT)'),
          tradClass,
          tradStatus,
          resRes.hit ? `HIT [${resRes.blockRange}]` : (resRes.isFault ? 'FAULT' : 'MISS (Walk PT)'),
          resClass,
          resStatus
        );

        if (el.compareTradOutcome) {
          el.compareTradOutcome.textContent = tradRes.hit ? 'TLB HIT' : (tradRes.isFault ? 'PAGE FAULT' : 'TLB MISS');
          el.compareTradOutcome.className = `badge font-monospace ${tradRes.hit ? 'bg-success text-white' : 'bg-danger text-white'}`;
        }

        if (el.compareResearchOutcome) {
          el.compareResearchOutcome.textContent = resRes.hit ? 'COALESCED HIT' : (resRes.isFault ? 'PAGE FAULT' : 'TLB MISS');
          el.compareResearchOutcome.className = `badge font-monospace ${resRes.hit ? 'bg-success text-white' : 'bg-danger text-white'}`;
        }
        if (el.compareResearchBlock) el.compareResearchBlock.textContent = resRes.blockRange || 'None';

        renderCompareTraditionalTable();
        renderCompareResearchTable();

        const tradNarr = tradRes.hit
          ? `Traditional: VPN ${vpn} found in Slot #${tradRes.slotIndex}. TLB Hit.`
          : (tradRes.isFault ? `Traditional: Page Fault.` : `Traditional: TLB Miss. Checked page table to find Frame ${tradRes.pfn}.`);
        const resNarr = resRes.hit
          ? `Coalesced: VPN ${vpn} is inside cached range ${resRes.blockRange}. TLB Hit.`
          : (resRes.isFault ? `Coalesced: Page Fault.` : `Coalesced: TLB Miss. Stored range ${resRes.blockRange} into TLB.`);

        let detailMsg = '';
        if (resRes.prefetchBlock) {
          detailMsg = `Prefetch loaded the next block [${resRes.prefetchBlock.startVPN}..${resRes.prefetchBlock.startVPN + resRes.prefetchBlock.blockSize - 1}] from memory ahead of demand!`;
        } else if (tradRes.evicted) {
          detailMsg = `Traditional TLB was full: FIFO removed oldest VPN ${tradRes.evicted.vpn}.`;
        } else {
          detailMsg = 'Notice how coalesced ranges reduce misses for sequential addresses.';
        }

        setNarration('Stage 3 Outcome', `${tradNarr} ${resNarr}`, detailMsg);

        // Stage 4: Physical Address Output
        const delayToStage4 = (tradRes.hit && resRes.hit) ? SIMULATION_SPEED.stageDecomposeMs : SIMULATION_SPEED.stageMemoryWalkMs;
        addTimeout(() => {
          const tradPAText = tradRes.pa !== null ? tradRes.pa.toString() : 'UNMAPPED';
          const resPAText = resRes.pa !== null ? resRes.pa.toString() : 'UNMAPPED';
          const resBlockText = resRes.blockRange || 'None';

          renderComparisonViews(va, vpn, offset, tradOutcomeText, tradPAText, resOutcomeText, resPAText, resBlockText);
          markAddressChip(state.currentStepIndex, (tradRes.hit || resRes.hit) ? 'hit' : 'miss');

          updateComparisonPacketPositions(
            4,
            tradRes.pa !== null ? `PA ${tradRes.pa}` : 'FAULT',
            tradClass,
            `Stage 4: PA ${tradPAText}`,
            resRes.pa !== null ? `PA ${resRes.pa}` : 'FAULT',
            resClass,
            `Stage 4: PA ${resPAText}`
          );

          setNarration(
            'Stage 4: RAM Access',
            `Physical Address = ${tradPAText}. Address translation complete for both engines.`,
            `Traditional PT walks: ${state.traditionalStats.demandWalks} | Coalesced PT walks: ${state.researchStats.demandWalks} (demand) + ${state.researchStats.prefetchWalks} (prefetch).`
          );

          addTimeout(finishStep, SIMULATION_SPEED.stepDelayMs);
        }, delayToStage4);

      }, SIMULATION_SPEED.stageLookupMs);
    }, SIMULATION_SPEED.stageDecomposeMs);
  }, SIMULATION_SPEED.stageDecomposeMs);
}

/**
 * Fast-forward current step instantly if user clicks Next Step during animation.
 * Uses already-computed execution state to prevent double-counting.
 */
function finishCurrentAddressInstantly() {
  clearActiveTimeouts();
  if (state.currentStepIndex >= state.addressSequence.length) return;
  if (state.currentExecution) {
    applyInstantStepVisuals(state.currentExecution);
  }
  finishStep();
}

/**
 * Universal Step Completion:
 * Advances step index by exactly 1, updates UI, schedules next address if playing.
 */
function finishStep() {
  state.currentStepIndex++;
  state.isPhaseAnimating = false;
  state.currentExecution = null;

  // Undim all stages upon step completion
  [el.nodeVirtualAddress, el.nodeDecomposition, el.nodeTLB, el.nodePhysicalAddress].forEach(n => {
    if (n) n.classList.remove('pipeline-dimmed');
  });

  updateUI();

  if (state.isPlaying) {
    if (state.currentStepIndex < state.addressSequence.length) {
      state.playTimer = setTimeout(() => {
        executeNextStep(false);
      }, SIMULATION_SPEED.stepDelayMs);
    } else {
      pausePlay();
      setNarration('Finished', 'All requested virtual addresses in sequence have been translated!', 'Review final statistics or click Reset.');
      setOutcomeBadge('COMPLETE', 'bg-info text-white');
    }
  }
}

function executeRunAll() {
  pausePlay();
  clearAllTimers();
  if (!ensureLatestInputsApplied(true)) return;
  while (state.currentStepIndex < state.addressSequence.length) {
    executeNextStep(true);
  }
  setNarration('Completed', `Processed all ${state.addressSequence.length} addresses in sequence.`, 'Examine final cache states and metrics.');
  setOutcomeBadge('COMPLETE', 'bg-info text-white');
  ensurePipelineVisible();
}

/* --- 9. Playback Controls --- */
function togglePlayPause() {
  if (state.isPlaying) pausePlay();
  else startPlay();
}

function startPlay() {
  if (!ensureLatestInputsApplied(true)) return;
  if (state.currentStepIndex >= state.addressSequence.length) {
    startNewSimulation();
  }
  state.isPlaying = true;
  if (el.playPauseIcon) el.playPauseIcon.className = 'bi bi-pause-fill fs-6';
  if (el.playPauseText) el.playPauseText.textContent = 'Pause';
  if (el.btnPlayPause) {
    el.btnPlayPause.classList.remove('btn-success');
    el.btnPlayPause.classList.add('btn-warning');
  }

  if (!state.isPhaseAnimating) {
    executeNextStep(false);
  }
}

function pausePlay() {
  state.isPlaying = false;
  if (state.playTimer) {
    clearTimeout(state.playTimer);
    state.playTimer = null;
  }
  if (el.playPauseIcon) el.playPauseIcon.className = 'bi bi-play-fill fs-6';
  if (el.playPauseText) el.playPauseText.textContent = 'Play';
  if (el.btnPlayPause) {
    el.btnPlayPause.classList.remove('btn-warning');
    el.btnPlayPause.classList.add('btn-success');
  }
}

function resetSimulation() {
  pausePlay();
  clearAllTimers();
  const config = validateAndParseInputs(false);
  if (config) {
    applyConfiguration(config);
  } else {
    initializeSimulationState();
  }
  setNarration('Reset', 'Simulation reset to Step 0.', 'Ready to begin translation.');
  setOutcomeBadge('READY', 'bg-primary-subtle text-primary border border-primary-subtle');
  ensurePipelineVisible();
}

function switchMode(newMode) {
  if (state.mode === newMode) return;
  pausePlay();
  clearAllTimers();
  state.mode = newMode;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-mode') === newMode) btn.classList.add('active');
  });

  const isComp = (newMode === SIM_MODES.COMPARE);
  if (el.singleSimulationView) el.singleSimulationView.classList.toggle('d-none', isComp);
  if (el.compareSimulationView) el.compareSimulationView.classList.toggle('d-none', !isComp);

  const config = validateAndParseInputs(true);
  if (config) {
    state.pageSize = config.pageSize;
    state.tlbCapacity = config.tlbCapacity;
    state.pageTable = config.pageTable;
    state.addressSequence = config.addressSequence;
    state.coalescedBlocks = identifyCoalescedBlocks(state.pageTable);
  }

  initializeSimulationState();
  setNarration('Mode Switched', `Switched to ${getModeDisplayName(newMode)}.`, 'Simulation reset for selected architecture.');
  setOutcomeBadge('STANDBY', 'bg-light text-secondary border');
}

function getModeDisplayName(mode) {
  if (mode === SIM_MODES.TRADITIONAL) return 'Traditional TLB';
  if (mode === SIM_MODES.RESEARCH) return 'Coalesced & Prefetch TLB';
  return 'Side-by-Side Comparison';
}

/* --- 10. UI Rendering & Table Builders --- */
function updateUI() {
  updateLiveCounters();
  renderAddressRibbon();

  if (state.mode === SIM_MODES.COMPARE) {
    renderCompareTraditionalTable();
    renderCompareResearchTable();
  } else if (state.mode === SIM_MODES.RESEARCH) {
    renderResearchTLBTable();
  } else {
    renderTraditionalTLBTable();
  }

  renderPageTable();
}

function setNarration(phaseBadge, mainText, whyText) {
  if (el.narrationPhaseBadge) el.narrationPhaseBadge.textContent = phaseBadge;
  if (el.narrationText) {
    el.narrationText.innerHTML = `${mainText} <span class="d-block text-secondary small fw-normal mt-1">${whyText || ''}</span>`;
  }
}

function setOutcomeBadge(text, badgeClasses) {
  if (el.lookupOutcomeBadge) {
    el.lookupOutcomeBadge.className = `badge px-3 py-2 fs-6 fw-bold text-uppercase shadow-sm ${badgeClasses}`;
    el.lookupOutcomeBadge.textContent = text;
  }
}

function updateLiveCounters() {
  const stats = (state.mode === SIM_MODES.RESEARCH) ? state.researchStats : state.traditionalStats;
  const rate = stats.accesses > 0 ? ((stats.hits / stats.accesses) * 100).toFixed(1) : '0.0';

  if (el.quickHitsCount) el.quickHitsCount.textContent = stats.hits;
  if (el.quickMissesCount) el.quickMissesCount.textContent = stats.misses;
  if (el.quickHitRate) el.quickHitRate.textContent = `${rate}%`;

  if (el.sequenceStepCounter) {
    el.sequenceStepCounter.textContent = `${state.currentStepIndex} / ${state.addressSequence.length} Completed`;
  }
}

function clearPipelineHighlightStates() {
  [el.nodeVirtualAddress, el.nodeDecomposition, el.nodeTLB, el.nodePageTable, el.nodePhysicalAddress].forEach(n => {
    if (n) n.className = n.className.replace(/\bstate-\w+\b/g, '').replace(/\bpipeline-dimmed\b/g, '').trim();
  });
  if (el.narrationBanner) {
    el.narrationBanner.className = el.narrationBanner.className.replace(/\bbanner-\w+\b/g, '').trim();
  }
}

function setNodeState(nodeEl, stateClass) {
  if (!nodeEl) return;
  nodeEl.classList.remove('state-active', 'state-hit', 'state-miss', 'state-prefetch');
  nodeEl.classList.add(stateClass);

  if (el.narrationBanner) {
    el.narrationBanner.classList.remove('banner-hit', 'banner-miss', 'banner-prefetch');
    if (stateClass === 'state-hit') el.narrationBanner.classList.add('banner-hit');
    if (stateClass === 'state-miss') el.narrationBanner.classList.add('banner-miss');
    if (stateClass === 'state-prefetch') el.narrationBanner.classList.add('banner-prefetch');
  }
}

function setText(elem, val) {
  if (elem) elem.textContent = val;
}

function renderStage1And2(va, decomp) {
  setNodeState(el.nodeVirtualAddress, 'state-active');
  setNodeState(el.nodeDecomposition, 'state-active');
  setText(el.dispVirtualAddress, va);
  setText(el.dispVPN, decomp.vpn);
  setText(el.dispVpnFormula, `\u230a${va} / ${state.pageSize}\u230b = ${decomp.vpn}`);
  setText(el.dispOffset, decomp.offset);
  setText(el.dispOffsetFormula, `${va} % ${state.pageSize} = ${decomp.offset}`);
}

function renderPhysicalAddress(pfn, offset, pa) {
  setNodeState(el.nodePhysicalAddress, 'state-hit');
  setText(el.dispPFN, pfn);
  setText(el.dispFinalOffset, offset);
  setText(el.dispPhysicalAddress, pa);
  setText(el.dispPaFormula, `(${pfn} \u00d7 ${state.pageSize}) + ${offset} = ${pa}`);
}

function renderUnmappedAddress() {
  setNodeState(el.nodePhysicalAddress, 'state-miss');
  setText(el.dispPFN, 'None');
  setText(el.dispFinalOffset, '--');
  setText(el.dispPhysicalAddress, 'PAGE FAULT');
  setText(el.dispPaFormula, 'Virtual Page unmapped in Page Table');
}

function resetPipelineDisplays() {
  clearPipelineHighlightStates();
  updatePacketPosition(1, 'VA --', '', 'Stage 1: Awaiting Virtual Address');
  updateComparisonPacketPositions(1, 'VA --', '', 'Standby', 'VA --', '', 'Standby');

  setText(el.dispVirtualAddress, '--');
  setText(el.dispVPN, '--');
  setText(el.dispVpnFormula, '\u230aVA / PageSize\u230b');
  setText(el.dispOffset, '--');
  setText(el.dispOffsetFormula, 'VA % PageSize');
  setText(el.dispPFN, '--');
  setText(el.dispFinalOffset, '--');
  setText(el.dispPhysicalAddress, '--');
  setText(el.dispPaFormula, '(PFN \u00d7 PageSize) + Offset');
  setText(el.ptWalkMsg, 'DRAM reference page table');
  if (el.ptRefStatusBadge) {
    el.ptRefStatusBadge.className = 'badge bg-light text-secondary border fs-xs';
    el.ptRefStatusBadge.textContent = 'Passive';
  }

  // Clear comparison strip outcomes and fields
  if (el.compareTradOutcome) {
    el.compareTradOutcome.textContent = 'Standby';
    el.compareTradOutcome.className = 'badge bg-light text-primary border font-monospace';
  }
  setText(el.compareTradVA, '--');
  setText(el.compareTradVpnOff, '--');
  setText(el.compareTradPA, '--');

  if (el.compareResearchOutcome) {
    el.compareResearchOutcome.textContent = 'Standby';
    el.compareResearchOutcome.className = 'badge bg-light text-purple border font-monospace';
  }
  setText(el.compareResearchVA, '--');
  setText(el.compareResearchBlock, '--');
  setText(el.compareResearchPA, '--');
  setText(el.compareTradHits, '0');
  setText(el.compareTradMisses, '0');
  setText(el.compareTradHitRate, '0.0%');
  setText(el.compareTradWalks, '0');
  setText(el.compareResearchHits, '0');
  setText(el.compareResearchMisses, '0');
  setText(el.compareResearchHitRate, '0.0%');
  setText(el.compareResearchWalks, '0 / 0');
}

function triggerTLBSearchScan() {
  if (!el.tlbTableBody) return;
  const rows = el.tlbTableBody.querySelectorAll('.tlb-row');
  rows.forEach((row, i) => {
    setTimeout(() => {
      row.classList.add('row-searching');
      setTimeout(() => row.classList.remove('row-searching'), 1200);
    }, i * 250);
  });
}

function renderTraditionalTLBTable() {
  if (el.tlbCapacityBadge) el.tlbCapacityBadge.textContent = `${state.traditionalTLB.length} / ${state.tlbCapacity} Slots`;
  if (el.thTlbKey) el.thTlbKey.textContent = 'VPN';
  if (el.thTlbVal) el.thTlbVal.textContent = 'PFN';
  if (el.thTlbExtra) el.thTlbExtra.textContent = 'FIFO Order';
  renderTraditionalRowsInto(el.tlbTableBody);
}

function renderCompareTraditionalTable() {
  renderTraditionalRowsInto(el.compareTradTableBody);
}

function renderTraditionalRowsInto(tbody) {
  if (!tbody) return;
  let html = '';
  for (let i = 0; i < state.tlbCapacity; i++) {
    const entry = state.traditionalTLB[i];
    html += entry
      ? `<tr class="tlb-row border-bottom" data-slot="${i}"><td class="text-secondary fw-semibold">#${i}</td><td class="text-primary fw-bold">${entry.vpn}</td><td class="text-success fw-bold">${entry.pfn}</td><td class="text-muted small">#${entry.insertOrder}</td><td><span class="badge bg-success-subtle text-success border border-success-subtle">Valid</span></td></tr>`
      : `<tr class="tlb-row row-empty border-bottom" data-slot="${i}"><td class="text-muted">#${i}</td><td class="text-muted">--</td><td class="text-muted">--</td><td class="text-muted">--</td><td><span class="badge bg-light text-muted border">Empty</span></td></tr>`;
  }
  tbody.innerHTML = html;
}

function renderResearchTLBTable() {
  const tlb = state.researchTLB;
  if (el.tlbCapacityBadge) el.tlbCapacityBadge.textContent = `${tlb.tlbStartPage.length} / ${state.tlbCapacity} Blocks`;
  if (el.thTlbKey) el.thTlbKey.textContent = 'VPN Range';
  if (el.thTlbVal) el.thTlbVal.textContent = 'Base PFN';
  if (el.thTlbExtra) el.thTlbExtra.textContent = 'Block Size';
  renderResearchRowsInto(el.tlbTableBody);
}

function renderCompareResearchTable() {
  renderResearchRowsInto(el.compareResearchTableBody);
}

function renderResearchRowsInto(tbody) {
  if (!tbody) return;
  const tlb = state.researchTLB;
  let html = '';
  for (let i = 0; i < state.tlbCapacity; i++) {
    if (i < tlb.tlbStartPage.length) {
      const start = tlb.tlbStartPage[i], pfn = tlb.tlbStartFrame[i], size = tlb.tlbBlockSize[i], isPref = tlb.tlbIsPrefetched[i];
      const range = size > 1 ? `[${start}..${start + size - 1}]` : `${start}`;
      const badge = isPref ? '<span class="badge bg-purple text-white"><i class="bi bi-stars me-1"></i>Prefetched</span>' : (size > 1 ? '<span class="badge bg-info-subtle text-info border">Coalesced</span>' : '<span class="badge bg-success-subtle text-success border">Demand</span>');
      html += `<tr class="tlb-row border-bottom" data-slot="${i}"><td class="text-secondary fw-semibold">#${i}</td><td class="text-purple fw-bold">${range}</td><td class="text-success fw-bold">${pfn}</td><td class="text-primary fw-bold">${size} ${size > 1 ? 'pages' : 'page'}</td><td>${badge}</td></tr>`;
    } else {
      html += `<tr class="tlb-row row-empty border-bottom" data-slot="${i}"><td class="text-muted">#${i}</td><td class="text-muted">--</td><td class="text-muted">--</td><td class="text-muted">--</td><td><span class="badge bg-light text-muted border">Empty</span></td></tr>`;
    }
  }
  tbody.innerHTML = html;
}

function renderPageTable() {
  if (!el.ptTableBody) return;
  const entries = Array.from(state.pageTable.entries()).sort((a, b) => a[0] - b[0]);
  let html = '';
  for (const [vpn, pfn] of entries) {
    const block = findCoalescedBlockForVPN(vpn, state.coalescedBlocks);
    const blockChip = (block && block.blockSize > 1) ? `<span class="coalesced-block-chip ms-1">Block [${block.startVPN}..${block.startVPN + block.blockSize - 1}]</span>` : '';
    html += `<tr class="pt-row" data-vpn="${vpn}"><td class="fw-bold text-primary">VPN ${vpn}</td><td class="text-success fw-bold">PFN ${pfn}</td><td><span class="badge bg-success-subtle text-success border border-success-subtle">Mapped in RAM</span>${blockChip}</td></tr>`;
  }
  el.ptTableBody.innerHTML = html;
}

function renderAddressRibbon() {
  if (!el.addressRibbon) return;
  let html = '';
  state.addressSequence.forEach((va, idx) => {
    let chipClass = 'addr-chip';
    if (idx < state.currentStepIndex) chipClass += ' hit';
    else if (idx === state.currentStepIndex) chipClass += ' active';
    else chipClass += ' pending';

    html += `<span class="${chipClass}" data-index="${idx}">
      <span class="small text-muted">#${idx + 1}</span>
      <strong>${va}</strong>
    </span>`;
  });
  el.addressRibbon.innerHTML = html;
}

function updateAddressRibbon(currentIndex) {
  const chips = el.addressRibbon?.querySelectorAll('.addr-chip');
  if (!chips) return;
  chips.forEach((c, idx) => {
    c.classList.remove('active');
    if (idx === currentIndex) c.classList.add('active');
  });
}

function markAddressChip(index, outcome) {
  const chips = el.addressRibbon?.querySelectorAll('.addr-chip');
  if (chips && chips[index]) {
    chips[index].classList.remove('active', 'pending', 'hit', 'miss');
    chips[index].classList.add(outcome);
  }
}

function highlightTLBRow(slotIndex, highlightClass) {
  if (!el.tlbTableBody) return;
  const row = el.tlbTableBody.querySelector(`[data-slot="${slotIndex}"]`);
  if (row) {
    row.classList.remove('row-hit', 'row-evicted', 'row-prefetched', 'row-inserted');
    row.classList.add(highlightClass);
    setTimeout(() => row.classList.remove(highlightClass), 4500);
  }
}

function highlightPageTableRow(vpn, highlightClass) {
  if (!el.ptTableBody) return;
  const row = el.ptTableBody.querySelector(`[data-vpn="${vpn}"]`);
  if (row) {
    row.classList.add(highlightClass);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => row.classList.remove(highlightClass), 5000);
  }
}

function renderComparisonViews(va, vpn, offset, tradOutcome, tradPA, resOutcome, resPA, resBlock) {
  const ts = state.traditionalStats;
  const rs = state.researchStats;
  const tRate = ts.accesses > 0 ? `${((ts.hits / ts.accesses) * 100).toFixed(1)}%` : '0.0%';
  const rRate = rs.accesses > 0 ? `${((rs.hits / rs.accesses) * 100).toFixed(1)}%` : '0.0%';

  if (el.compareTradOutcome) {
    el.compareTradOutcome.textContent = tradOutcome;
    el.compareTradOutcome.className = `badge font-monospace ${tradOutcome.includes('HIT') ? 'bg-success text-white' : 'bg-danger text-white'}`;
  }
  setText(el.compareTradVA, va);
  setText(el.compareTradVpnOff, `VPN ${vpn} | Offset ${offset}`);
  setText(el.compareTradPA, tradPA);
  setText(el.compareTradHits, ts.hits);
  setText(el.compareTradMisses, ts.misses);
  setText(el.compareTradHitRate, tRate);
  setText(el.compareTradWalks, ts.demandWalks);

  if (el.compareResearchOutcome) {
    el.compareResearchOutcome.textContent = resOutcome;
    el.compareResearchOutcome.className = `badge font-monospace ${resOutcome.includes('HIT') ? 'bg-success text-white' : 'bg-danger text-white'}`;
  }
  setText(el.compareResearchVA, va);
  setText(el.compareResearchBlock, resBlock);
  setText(el.compareResearchPA, resPA);
  setText(el.compareResearchHits, rs.hits);
  setText(el.compareResearchMisses, rs.misses);
  setText(el.compareResearchHitRate, rRate);
  setText(el.compareResearchWalks, `${rs.demandWalks} / ${rs.prefetchWalks}`);

  renderCompareTraditionalTable();
  renderCompareResearchTable();
}
