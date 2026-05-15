const metrics = ['cost', 'delta', 'gamma', 'vega', 'theta', 'rho', 'volga', 'vanna'];
const metricLayout = [
  ['cost', 'delta', 'gamma'],
  ['vega', 'theta', 'rho'],
  ['volga', 'vanna'],
];
const legsElement = document.getElementById('legs');
const summaryElement = document.getElementById('summary');
const invalidElement = document.getElementById('invalid');
const spotInput = document.getElementById('spot');
const rateInput = document.getElementById('rate');
const volatilityInput = document.getElementById('volatility');
const multiplierInput = document.getElementById('multiplier');
const plotPayoffButton = document.getElementById('plot-payoff');
let activeMetric = 'delta';
let legs = [
  { kind: 'call', side: 'buy', qty: 1, strike: 100, time: 0.5, dividend: 0 },
];

function normPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function normCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * absX);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * y);
}

function blackScholes(kind, spot, strike, time, rate, vol, dividend) {
  const rootTime = Math.sqrt(time);
  const d1 = (Math.log(spot / strike) + (rate - dividend + 0.5 * vol * vol) * time) / (vol * rootTime);
  const d2 = d1 - vol * rootTime;
  const spotDiscount = Math.exp(-dividend * time);
  const strikeDiscount = Math.exp(-rate * time);
  const discountedSpot = spot * spotDiscount;
  const discountedStrike = strike * strikeDiscount;
  const pdf = normPdf(d1);
  const vega = spot * spotDiscount * pdf * rootTime;
  let price;
  let delta;
  let theta;
  let rho;

  if (kind === 'call') {
    price = discountedSpot * normCdf(d1) - discountedStrike * normCdf(d2);
    delta = spotDiscount * normCdf(d1);
    theta = -(spot * spotDiscount * pdf * vol) / (2 * rootTime) - rate * strike * strikeDiscount * normCdf(d2) + dividend * spot * spotDiscount * normCdf(d1);
    rho = strike * time * strikeDiscount * normCdf(d2);
  } else {
    price = discountedStrike * normCdf(-d2) - discountedSpot * normCdf(-d1);
    delta = spotDiscount * (normCdf(d1) - 1);
    theta = -(spot * spotDiscount * pdf * vol) / (2 * rootTime) + rate * strike * strikeDiscount * normCdf(-d2) - dividend * spot * spotDiscount * normCdf(-d1);
    rho = -strike * time * strikeDiscount * normCdf(-d2);
  }

  return {
    cost: price,
    delta,
    gamma: spotDiscount * pdf / (spot * vol * rootTime),
    vega,
    theta,
    rho,
    volga: vega * d1 * d2 / vol,
    vanna: -spotDiscount * pdf * d2 / vol,
  };
}

function toNumber(value) {
  if (value === '') {
    return NaN;
  }

  return Number(value);
}

function readInputs(spotOverride = null, strikeOverride = null) {
  const spot = spotOverride === null ? toNumber(spotInput.value) : spotOverride;
  const globalRate = toNumber(rateInput.value) / 100;
  const globalVolatility = toNumber(volatilityInput.value) / 100;
  const multiplier = toNumber(multiplierInput.value);

  if (!(spot > 0) || !Number.isFinite(globalRate) || !(globalVolatility > 0) || !(multiplier > 0)) {
    return null;
  }

  const parsedLegs = legs.map((leg) => {
    return {
      kind: leg.kind,
      side: leg.side,
      qty: toNumber(leg.qty),
      strike: strikeOverride === null ? toNumber(leg.strike) : strikeOverride,
      time: toNumber(leg.time),
      vol: globalVolatility,
      rate: globalRate,
      dividend: toNumber(leg.dividend) / 100,
    };
  });

  const validLegs = parsedLegs.every((leg) => (
    Number.isFinite(leg.qty) &&
    leg.qty > 0 &&
    leg.strike > 0 &&
    leg.time > 0 &&
    leg.vol > 0 &&
    Number.isFinite(leg.rate) &&
    Number.isFinite(leg.dividend)
  ));

  if (!validLegs) {
    return null;
  }

  return { spot, multiplier, legs: parsedLegs };
}

function calculatePortfolio(spotOverride = null, strikeOverride = null) {
  const inputs = readInputs(spotOverride, strikeOverride);

  if (!inputs) {
    return null;
  }

  return inputs.legs.reduce((totals, leg) => {
    const sign = leg.side === 'buy' ? 1 : -1;
    const scale = sign * leg.qty * inputs.multiplier;
    const values = blackScholes(leg.kind, inputs.spot, leg.strike, leg.time, leg.rate, leg.vol, leg.dividend);

    for (let metric of metrics) {
      totals[metric] += values[metric] * scale;
    }

    return totals;
  }, Object.fromEntries(metrics.map((metric) => [metric, 0])));
}

function calculatePayoff(spotOverride) {
  const inputs = readInputs(spotOverride);

  if (!inputs) {
    return null;
  }

  return inputs.legs.reduce((total, leg) => {
    const sign = leg.side === 'buy' ? 1 : -1;
    const scale = sign * leg.qty * inputs.multiplier;
    const intrinsic = leg.kind === 'call'
      ? Math.max(inputs.spot - leg.strike, 0)
      : Math.max(leg.strike - inputs.spot, 0);

    return total + intrinsic * scale;
  }, 0);
}

function formatValue(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: Math.abs(value) < 10 ? 4 : 2,
    maximumFractionDigits: Math.abs(value) < 10 ? 4 : 2,
  });
}

function renderSummary(totals) {
  summaryElement.innerHTML = '';

  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    for (let columnIndex = 0; columnIndex < metricLayout.length; columnIndex++) {
      const metric = metricLayout[columnIndex][rowIndex];

      if (!metric) {
        summaryElement.appendChild(document.createElement('div'));
        continue;
      }

      const row = document.createElement('div');
      row.className = 'metric';

      const name = document.createElement('span');
      name.className = 'metric-label';

      if (metric === 'volga') {
        name.textContent = 'volga (vol of vol)';
      } else if (metric === 'vanna') {
        name.innerHTML = 'vanna (<span class="metric-formula"><span>&part;Vega</span><span>&part;Spot</span></span>)';
      } else {
        name.textContent = metric;
      }

      const value = document.createElement('span');
      value.textContent = totals ? formatValue(totals[metric]) : '--';

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'plot';
      button.addEventListener('click', () => {
        activeMetric = metric;
        update();
      });

      row.append(name, value, button);
      summaryElement.appendChild(row);
    }
  }
}

function renderLegs() {
  legsElement.innerHTML = '';

  legs.forEach((leg, index) => {
    const row = document.createElement('div');
    row.className = 'leg';
    row.innerHTML = `
      <select data-field="side">
        <option value="buy">buy</option>
        <option value="sell">sell</option>
      </select>
      <select data-field="kind">
        <option value="call">call</option>
        <option value="put">put</option>
      </select>
      <input data-field="qty" type="number" min="0.01" step="0.01">
      <input data-field="strike" type="number" min="0.01" step="0.01">
      <input data-field="time" type="number" min="0.0001" step="0.01">
      <input data-field="dividend" type="number" step="0.01">
      <button type="button">x</button>
    `;

    row.querySelector('[data-field="side"]').value = leg.side;
    row.querySelector('[data-field="kind"]').value = leg.kind;
    row.querySelector('[data-field="qty"]').value = leg.qty;
    row.querySelector('[data-field="strike"]').value = leg.strike;
    row.querySelector('[data-field="time"]').value = leg.time;
    row.querySelector('[data-field="dividend"]').value = leg.dividend;

    row.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('input', () => {
        legs[index][input.dataset.field] = input.value;
        update();
      });
    });

    row.querySelector('button').addEventListener('click', () => {
      legs.splice(index, 1);

      if (legs.length === 0) {
        legs.push({ kind: 'call', side: 'buy', qty: 1, strike: 100, time: 0.5, dividend: 0 });
      }

      renderLegs();
      update();
    });

    legsElement.appendChild(row);
  });
}

function plotMetric() {
  const spot = toNumber(spotInput.value);

  if (!(spot > 0)) {
    Plotly.purge('plot');
    return;
  }

  if (activeMetric === 'payoff') {
    plotPayoff(spot);
    return;
  }

  const minStrike = Math.max(0.01, spot * 0.45);
  const maxStrike = spot * 1.55;
  const steps = 100;
  const x = [];
  const y = [];

  for (let i = 0; i <= steps; i++) {
    const level = minStrike + ((maxStrike - minStrike) * i) / steps;
    const totals = calculatePortfolio(null, level);

    if (!totals) {
      Plotly.purge('plot');
      return;
    }

    x.push(level);
    y.push(totals[activeMetric]);
  }

  Plotly.react('plot', [{
    x,
    y,
    type: 'scatter',
    mode: 'lines',
    line: { color: '#ffffff', width: 2 },
  }], {
    paper_bgcolor: '#000000',
    plot_bgcolor: '#000000',
    font: { color: '#ffffff', family: 'Source Code Pro, monospace' },
    margin: { l: 64, r: 24, t: 36, b: 54 },
    title: `${activeMetric} vs strike`,
    xaxis: {
      title: 'strike',
      gridcolor: 'rgba(255,255,255,0.16)',
      zerolinecolor: 'rgba(255,255,255,0.3)',
    },
    yaxis: {
      title: activeMetric,
      gridcolor: 'rgba(255,255,255,0.16)',
      zerolinecolor: 'rgba(255,255,255,0.3)',
    },
    shapes: [{
      type: 'line',
      x0: spot,
      x1: spot,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: '#ff4444', dash: 'dash', width: 2 },
    }],
  }, {
    displayModeBar: false,
    responsive: true,
  });
}

function plotPayoff(spot) {
  const minSpot = Math.max(0.01, spot * 0.45);
  const maxSpot = spot * 1.55;
  const steps = 100;
  const x = [];
  const y = [];

  for (let i = 0; i <= steps; i++) {
    const level = minSpot + ((maxSpot - minSpot) * i) / steps;
    const payoff = calculatePayoff(level);

    if (payoff === null) {
      Plotly.purge('plot');
      return;
    }

    x.push(level);
    y.push(payoff);
  }

  Plotly.react('plot', [{
    x,
    y,
    type: 'scatter',
    mode: 'lines',
    line: { color: '#ffffff', width: 2 },
  }], {
    paper_bgcolor: '#000000',
    plot_bgcolor: '#000000',
    font: { color: '#ffffff', family: 'Source Code Pro, monospace' },
    margin: { l: 64, r: 24, t: 36, b: 54 },
    title: 'payoff vs spot',
    xaxis: {
      title: 'spot',
      gridcolor: 'rgba(255,255,255,0.16)',
      zerolinecolor: 'rgba(255,255,255,0.3)',
    },
    yaxis: {
      title: 'payoff',
      gridcolor: 'rgba(255,255,255,0.16)',
      zerolinecolor: 'rgba(255,255,255,0.3)',
    },
    shapes: [{
      type: 'line',
      x0: spot,
      x1: spot,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: '#ff4444', dash: 'dash', width: 2 },
    }],
  }, {
    displayModeBar: false,
    responsive: true,
  });
}

function update() {
  const totals = calculatePortfolio();
  invalidElement.textContent = totals ? '' : 'invalid inputs';
  renderSummary(totals);
  plotMetric();
}

document.getElementById('add-leg').addEventListener('click', () => {
  legs.push({ kind: 'call', side: 'buy', qty: 1, strike: toNumber(spotInput.value) || 100, time: 0.5, dividend: 0 });
  renderLegs();
  update();
});

plotPayoffButton.addEventListener('click', () => {
  activeMetric = 'payoff';
  update();
});

[spotInput, rateInput, volatilityInput, multiplierInput].forEach((input) => {
  input.addEventListener('input', update);
});

renderLegs();
update();
