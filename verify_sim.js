// Comprehensive verification script for Paging TLB simulator logic and DOM structure
const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const jsContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

console.log('=== TEST 1: DOM Structure & Simplification Checks ===');

// 1. Check Presets
const hasPresetNormal = htmlContent.includes('id="presetNormal"');
const hasPresetCoalesced = htmlContent.includes('id="presetCoalesced"');
const hasOldPresets = /id="(presetDefaultLab|presetContiguousPrefetch|presetFifoEviction|presetMixedUnmapped)"/.test(htmlContent);

console.log(`Preset 1 (presetNormal) present: ${hasPresetNormal}`);
console.log(`Preset 2 (presetCoalesced) present: ${hasPresetCoalesced}`);
console.log(`Old presets removed: ${!hasOldPresets}`);
if (!hasPresetNormal || !hasPresetCoalesced || hasOldPresets) {
  throw new Error('Preset checks failed!');
}

// 2. Check Controls (including btnPrevStep as required by user)
const hasStartSim = htmlContent.includes('id="btnStartSim"');
const hasPrevStep = htmlContent.includes('id="btnPrevStep"');
const hasNextStep = htmlContent.includes('id="btnNextStep"');
const hasPlayPause = htmlContent.includes('id="btnPlayPause"');
const hasRunAll = htmlContent.includes('id="btnRunAll"');
const hasReset = htmlContent.includes('id="btnReset"');
const hasSpeedRange = htmlContent.includes('id="speedRange"');

console.log(`Essential control StartSim present: ${hasStartSim}`);
console.log(`Essential control PrevStep present: ${hasPrevStep}`);
console.log(`Essential control NextStep present: ${hasNextStep}`);
console.log(`Essential control PlayPause present: ${hasPlayPause}`);
console.log(`Essential control RunAll present: ${hasRunAll}`);
console.log(`Essential control Reset present: ${hasReset}`);
console.log(`Non-essential SpeedRange removed: ${!hasSpeedRange}`);
if (!hasStartSim || !hasPrevStep || !hasNextStep || !hasPlayPause || !hasRunAll || !hasReset || hasSpeedRange) {
  throw new Error('Controls checks failed!');
}

// 3. Check Pipeline Stages & Clean Grid
const hasStage1 = htmlContent.includes('id="nodeVirtualAddress"');
const hasStage2 = htmlContent.includes('id="nodeDecomposition"');
const hasStage3 = htmlContent.includes('id="nodeTLB"');
const hasStage4 = htmlContent.includes('id="nodePhysicalAddress"');
const hasConnectors = /class="[^"]*pipeline-connector[^"]*"/.test(htmlContent);
const hasBinaryBadge = htmlContent.includes('id="dispVirtualAddressBinary"');
const hasMathStrip = htmlContent.includes('id="liveMathCalculationCard"');

console.log(`Stage 1 (Virtual Address) present: ${hasStage1}`);
console.log(`Stage 2 (Address Decomposition) present: ${hasStage2}`);
console.log(`Stage 3 (TLB Lookup) present: ${hasStage3}`);
console.log(`Stage 4 (Physical Address) present: ${hasStage4}`);
console.log(`Misaligned connectors removed: ${!hasConnectors}`);
console.log(`Redundant binary badge removed: ${!hasBinaryBadge}`);
console.log(`Redundant math strip removed: ${!hasMathStrip}`);
if (!hasStage1 || !hasStage2 || !hasStage3 || !hasStage4 || hasConnectors || hasBinaryBadge || hasMathStrip) {
  throw new Error('Pipeline stage checks failed!');
}

// 4. Check Page Table Reference Card outside pipeline
const pipelineGridIndex = htmlContent.indexOf('id="pipelineGrid"');
const pipelineGridEndIndex = htmlContent.indexOf('</div>', htmlContent.indexOf('id="nodePhysicalAddress"'));
const pageTableIndex = htmlContent.indexOf('id="nodePageTable"');

console.log(`Page Table placed after pipeline grid: ${pageTableIndex > pipelineGridEndIndex}`);
if (pageTableIndex <= pipelineGridEndIndex) {
  throw new Error('Page Table must be outside permanent pipeline grid!');
}

// 5. Check CSS layout
const has4ColGrid = cssContent.includes('grid-template-columns: 1fr 1.15fr 1.6fr 1.15fr;');
const hasCssConnectors = cssContent.includes('.pipeline-connector');
console.log(`CSS has 4-column horizontal pipeline grid: ${has4ColGrid}`);
console.log(`CSS connector styles removed: ${!hasCssConnectors}`);
if (!has4ColGrid || hasCssConnectors) {
  throw new Error('CSS pipeline layout checks failed!');
}

console.log('\n=== TEST 2: Simulation Logic Verification ===');

const dom = {};
function createMockEl(id) {
  let _val = '';
  const el = {
    id,
    get value() { return _val; },
    set value(v) { _val = (v !== undefined && v !== null) ? String(v) : ''; },
    textContent: '',
    innerHTML: '',
    className: '',
    classList: {
      add: (c) => { if (!el.className.includes(c)) el.className += ' ' + c; },
      remove: (c) => { el.className = el.className.replace(new RegExp('\\b' + c + '\\b', 'g'), '').trim(); },
      contains: (c) => el.className.includes(c),
      replace: (a, b) => { el.classList.remove(a); el.classList.add(b); },
      toggle: (c) => { if (el.classList.contains(c)) el.classList.remove(c); else el.classList.add(c); }
    },
    style: {},
    setAttribute: () => {},
    getAttribute: () => '',
    querySelectorAll: () => [],
    addEventListener: () => {},
    appendChild: () => {},
    scrollIntoView: () => {},
    getBoundingClientRect: () => ({ top: 150, height: 400 })
  };
  return el;
}

const mockIds = [
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
  'compRowAccessTrad', 'compRowAccessRes', 'compRowAccessDelta',
  'compRowHitsTrad', 'compRowHitsRes', 'compRowHitsDelta',
  'compRowMissesTrad', 'compRowMissesRes', 'compRowMissesDelta',
  'compRowHitRateTrad', 'compRowHitRateRes', 'compRowHitRateDelta',
  'compRowDemWalksTrad', 'compRowDemWalksRes', 'compRowDemWalksDelta',
  'compRowPrefWalksRes', 'compRowPrefWalksDelta',
  'compRowEvictTrad', 'compRowEvictRes', 'compRowEvictDelta',
  'barTradHitRate', 'barTradHitRateLabel', 'barResHitRate', 'barResHitRateLabel',
  'comparisonInsightBox', 'logTerminal', 'logCounterBadge', 'btnClearLog',
  'sectionMainSimulation'
];

global.window = {
  pageYOffset: 0,
  innerHeight: 800,
  scrollTo: () => {}
};

global.document = {
  getElementById: (id) => {
    if (!dom[id]) dom[id] = createMockEl(id);
    return dom[id];
  },
  querySelector: (sel) => {
    if (sel.includes('.app-header')) return createMockEl('appHeader');
    if (sel.includes('.mode-btn.active')) {
      if (dom.btnModeResearch && dom.btnModeResearch.classList.contains('active')) return { dataset: { mode: 'research' } };
      if (dom.btnModeCompare && dom.btnModeCompare.classList.contains('active')) return { dataset: { mode: 'compare' } };
      return { dataset: { mode: 'traditional' } };
    }
    return null;
  },
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => createMockEl('dynamic'),
  documentElement: { clientHeight: 800 }
};

// Evaluate script.js in sandbox
const vm = require('vm');
const context = vm.createContext(global);
const scriptToRun = jsContent + '\n; Object.assign(global, { cacheDomElements, loadPreset, switchMode, executeRunAll, executeNextStep, executePreviousStep, startNewSimulation, applyConfiguration, initializeSimulationState, state, PRESETS, SIM_MODES, getEl: () => el });';
vm.runInContext(scriptToRun, context);
cacheDomElements();
const el = getEl();

// Test Preset 1 (Normal TLB)
console.log('Testing Preset 1 (Normal TLB)...');
loadPreset(PRESETS.normal);
console.log(`PageSize: ${state.pageSize}, TLB Capacity: ${state.tlbCapacity}`);
console.log(`Address sequence: ${state.addressSequence.join(', ')}`);

// Step-by-Step validation of user test sequence: 120, 380, 120, 250
executeNextStep(true); // Address 120
if (dom.dispVPN.textContent != '1' || dom.dispOffset.textContent != '20' || dom.dispPFN.textContent != '2' || dom.dispPhysicalAddress.textContent != '220') {
  throw new Error(`Step 1 (120) failed: VPN=${dom.dispVPN.textContent}, PFN=${dom.dispPFN.textContent}, PA=${dom.dispPhysicalAddress.textContent}`);
}
console.log('Step 1 (120): VPN 1, offset 20, PFN 2, PA 220 -> PASSED');

executeNextStep(true); // Address 380
if (dom.dispVPN.textContent != '3' || dom.dispOffset.textContent != '80' || dom.dispPFN.textContent != '1' || dom.dispPhysicalAddress.textContent != '180') {
  throw new Error(`Step 2 (380) failed: VPN=${dom.dispVPN.textContent}, PFN=${dom.dispPFN.textContent}, PA=${dom.dispPhysicalAddress.textContent}`);
}
console.log('Step 2 (380): VPN 3, offset 80, PFN 1, PA 180 -> PASSED');

// Test Previous Step Rewind!
console.log('\nTesting Previous Step Rewind...');
executePreviousStep();
if (state.currentStepIndex !== 1 || state.traditionalStats.accesses !== 1) {
  throw new Error(`Previous Step failed: currentStepIndex=${state.currentStepIndex}, accesses=${state.traditionalStats.accesses}`);
}
console.log(`Rewound to Step ${state.currentStepIndex}: PASSED`);

// Re-advance step 2
executeNextStep(true);

executeNextStep(true); // Address 120 again -> HIT!
if (dom.lookupOutcomeBadge.textContent !== 'TLB HIT' || dom.dispPhysicalAddress.textContent != '220') {
  throw new Error(`Step 3 (120 again) expected TLB HIT, got ${dom.lookupOutcomeBadge.textContent}`);
}
console.log('Step 3 (120 again): TLB HIT -> PASSED');

executeNextStep(true); // Address 250
if (dom.dispVPN.textContent != '2' || dom.dispOffset.textContent != '50' || dom.dispPFN.textContent != '7' || dom.dispPhysicalAddress.textContent != '750') {
  throw new Error(`Step 4 (250) failed: VPN=${dom.dispVPN.textContent}, PFN=${dom.dispPFN.textContent}, PA=${dom.dispPhysicalAddress.textContent}`);
}
console.log('Step 4 (250): VPN 2, offset 50, PFN 7, PA 750 -> PASSED');

console.log(`Traditional TLB stats: Hits=${state.traditionalStats.hits}, Misses=${state.traditionalStats.misses}, Rate=${dom.quickHitRate.textContent}`);
if (state.traditionalStats.hits !== 1 || state.traditionalStats.misses !== 3) {
  throw new Error(`Preset 1 expected 1 hit and 3 misses, got Hits=${state.traditionalStats.hits}, Misses=${state.traditionalStats.misses}`);
}
console.log('Preset 1 verification: PASSED (1 Hit, 3 Misses, 25.0% Hit Rate)');

// Test Start Simulation button with customized inputs
console.log('\nTesting Start Simulation button (fresh run)...');
el.inputPageSize.value = '100';
el.inputTlbCapacity.value = '2';
el.inputPageTable.value = '0:10, 1:20';
el.inputAddressSequence.value = '150, 150';
const startSimSuccess = startNewSimulation();
if (!startSimSuccess || state.currentStepIndex !== 0 || state.traditionalStats.hits !== 0 || state.tlbCapacity !== 2) {
  throw new Error('Start Simulation button failed to initialize fresh simulation with new inputs!');
}
executeRunAll();
console.log(`Custom input stats: Hits=${state.traditionalStats.hits}, Misses=${state.traditionalStats.misses}`);
if (state.traditionalStats.hits !== 1 || state.traditionalStats.misses !== 1) {
  throw new Error(`Custom input expected 1 hit and 1 miss, got ${state.traditionalStats.hits} hits and ${state.traditionalStats.misses} misses`);
}
console.log('Start Simulation button verification: PASSED');

// Test Preset 2 (Coalesced TLB) in Research Mode
console.log('\nTesting Preset 2 (Coalesced TLB) in Research Mode...');
switchMode(SIM_MODES.RESEARCH);
loadPreset(PRESETS.coalesced);
executeRunAll();
console.log(`Research TLB stats: Hits=${state.researchStats.hits}, Misses=${state.researchStats.misses}, PrefetchWalks=${state.researchStats.prefetchWalks}, Rate=${dom.quickHitRate.textContent}`);
if (state.researchStats.hits < 3 || state.researchStats.prefetchWalks < 1) {
  throw new Error(`Preset 2 expected hits >= 3 and prefetch >= 1, got Hits=${state.researchStats.hits}, Prefetch=${state.researchStats.prefetchWalks}`);
}
console.log('Preset 2 verification: PASSED (Coalescing and Prefetching both verified!)');

// Test Comparison Mode
console.log('\nTesting Comparison Mode...');
switchMode(SIM_MODES.COMPARE);
loadPreset(PRESETS.coalesced);
executeRunAll();
console.log(`Comparison Mode Traditional: Hits=${state.traditionalStats.hits}, Misses=${state.traditionalStats.misses}`);
console.log(`Comparison Mode Research: Hits=${state.researchStats.hits}, Misses=${state.researchStats.misses}, Prefetch=${state.researchStats.prefetchWalks}`);
if (state.traditionalStats.accesses !== state.researchStats.accesses) {
  throw new Error('Comparison mode accesses must match between traditional and research!');
}
console.log('Comparison mode verification: PASSED');

console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
