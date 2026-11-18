// Navigation Tab Switching
const navButtons = document.querySelectorAll('.nav-btn');
const tabSections = document.querySelectorAll('.tab-section');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    navButtons.forEach(b => b.classList.remove('active'));
    tabSections.forEach(sec => sec.classList.remove('active'));

    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    document.getElementById(targetId).classList.add('active');
  });
});

// K-Map Solver Logic
const varSelect = document.getElementById('var-count');
const mintermInput = document.getElementById('minterm-input');
const applyBtn = document.getElementById('apply-minterms');
const fillOnesBtn = document.getElementById('fill-ones');
const clearBtn = document.getElementById('clear-btn');
const kmapContainer = document.getElementById('kmap-container');
const sopOutput = document.getElementById('sop-output');
const groupsList = document.getElementById('groups-list');

let numVars = 4;
let cellValues = [];

const configs = {
  2: { rowLabel: 'A', colLabel: 'B', rows: ['0', '1'], cols: ['0', '1'], vars: ['A', 'B'] },
  3: { rowLabel: 'A', colLabel: 'BC', rows: ['0', '1'], cols: ['00', '01', '11', '10'], vars: ['A', 'B', 'C'] },
  4: { rowLabel: 'AB', colLabel: 'CD', rows: ['00', '01', '11', '10'], cols: ['00', '01', '11', '10'], vars: ['A', 'B', 'C', 'D'] }
};

function initGrid() {
  numVars = parseInt(varSelect.value, 10);
  cellValues = new Array(1 << numVars).fill(0);
  renderGrid();
  solveKMap();
}

function renderGrid() {
  const cfg = configs[numVars];
  const table = document.createElement('table');
  table.className = 'kmap-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.textContent = `${cfg.rowLabel} \\ ${cfg.colLabel}`;
  headerRow.appendChild(corner);

  cfg.cols.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  cfg.rows.forEach(r => {
    const tr = document.createElement('tr');
    const rowHeader = document.createElement('th');
    rowHeader.textContent = r;
    tr.appendChild(rowHeader);

    cfg.cols.forEach(c => {
      const minterm = parseInt(r + c, 2);
      const val = cellValues[minterm];

      const td = document.createElement('td');
      td.className = val === 1 ? 'val-1' : val === 'X' ? 'val-X' : '';
      td.innerHTML = `<span class="minterm-idx">${minterm}</span>${val}`;

      td.addEventListener('click', () => {
        if (cellValues[minterm] === 0) cellValues[minterm] = 1;
        else if (cellValues[minterm] === 1) cellValues[minterm] = 'X';
        else cellValues[minterm] = 0;

        renderGrid();
        solveKMap();
      });

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  kmapContainer.innerHTML = '';
  kmapContainer.appendChild(table);
}

function solveKMap() {
  const ones = [];
  const allTerms = [];

  cellValues.forEach((val, idx) => {
    if (val === 1) {
      ones.push(idx);
      allTerms.push(idx);
    } else if (val === 'X') {
      allTerms.push(idx);
    }
  });

  if (ones.length === 0) {
    sopOutput.textContent = '0';
    groupsList.innerHTML = '<li>No minterms selected</li>';
    return;
  }

  if (allTerms.length === (1 << numVars)) {
    sopOutput.textContent = '1';
    groupsList.innerHTML = `<li>All cells covered (Group of ${1 << numVars})</li>`;
    return;
  }

  let current = allTerms.map(m => ({
    bits: m.toString(2).padStart(numVars, '0'),
    minterms: [m],
    used: false
  }));

  const primeImplicants = [];

  while (current.length > 0) {
    const nextMap = new Map();

    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const diff = getSingleBitDiff(current[i].bits, current[j].bits);
        if (diff !== -1) {
          current[i].used = true;
          current[j].used = true;
          const combinedBits =
            current[i].bits.substring(0, diff) + '-' + current[i].bits.substring(diff + 1);
          if (!nextMap.has(combinedBits)) {
            const combinedMinterms = Array.from(
              new Set([...current[i].minterms, ...current[j].minterms])
            ).sort((a, b) => a - b);
            nextMap.set(combinedBits, {
              bits: combinedBits,
              minterms: combinedMinterms,
              used: false
            });
          }
        }
      }
    }

    current.forEach(item => {
      if (!item.used) primeImplicants.push(item);
    });

    current = Array.from(nextMap.values());
  }

  const selectedPIs = selectMinimalCover(primeImplicants, ones);
  const varNames = configs[numVars].vars;

  const terms = selectedPIs.map(pi => bitsToExpression(pi.bits, varNames));
  sopOutput.textContent = terms.join(' + ');

  groupsList.innerHTML = selectedPIs
    .map(pi => {
      const expr = bitsToExpression(pi.bits, varNames);
      const coveredOnes = pi.minterms.filter(m => ones.includes(m));
      return `<li><strong>${expr}</strong> &rarr; Minterms: (${coveredOnes.join(', ')})</li>`;
    })
    .join('');
}

function getSingleBitDiff(a, b) {
  let diffIdx = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (diffIdx !== -1) return -1;
      diffIdx = i;
    }
  }
  return diffIdx;
}

function selectMinimalCover(pis, ones) {
  const uncovered = new Set(ones);
  const chosen = [];

  ones.forEach(m => {
    const covering = pis.filter(pi => pi.minterms.includes(m));
    if (covering.length === 1 && !chosen.includes(covering[0])) {
      chosen.push(covering[0]);
      covering[0].minterms.forEach(covered => uncovered.delete(covered));
    }
  });

  while (uncovered.size > 0) {
    let bestPI = null;
    let maxCover = 0;

    pis.forEach(pi => {
      if (chosen.includes(pi)) return;
      const count = pi.minterms.filter(m => uncovered.has(m)).length;
      if (count > maxCover) {
        maxCover = count;
        bestPI = pi;
      }
    });

    if (!bestPI) break;
    chosen.push(bestPI);
    bestPI.minterms.forEach(m => uncovered.delete(m));
  }

  return chosen;
}

function bitsToExpression(bits, varNames) {
  let expr = '';
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') expr += varNames[i];
    else if (bits[i] === '0') expr += `${varNames[i]}'`;
  }
  return expr || '1';
}

varSelect.addEventListener('change', initGrid);

applyBtn.addEventListener('click', () => {
  const maxVal = (1 << numVars) - 1;
  cellValues.fill(0);
  const parts = mintermInput.value.split(',');
  parts.forEach(p => {
    const num = parseInt(p.trim(), 10);
    if (!isNaN(num) && num >= 0 && num <= maxVal) {
      cellValues[num] = 1;
    }
  });
  renderGrid();
  solveKMap();
});

fillOnesBtn.addEventListener('click', () => {
  cellValues.fill(1);
  renderGrid();
  solveKMap();
});

clearBtn.addEventListener('click', () => {
  mintermInput.value = '';
  cellValues.fill(0);
  renderGrid();
  solveKMap();
});

initGrid();