'use strict';

// ─── Auth ────────────────────────────────────────────────────────────────────
const CREDENTIALS = { admin: 'password123' };
let currentZip = '10001';
let currentCity = 'ZIP: 10001';

function getSession() {
  return sessionStorage.getItem('wdash_user');
}

function setSession(user) {
  sessionStorage.setItem('wdash_user', user);
}

function clearSession() {
  sessionStorage.removeItem('wdash_user');
}

// ─── Weather data (today + next 9 days) ──────────────────────────────────────
const CONDITIONS = [
  { label: 'Sunny',   icon: '☀️',  cls: 'badge-sunny'  },
  { label: 'Cloudy',  icon: '☁️',  cls: 'badge-cloudy' },
  { label: 'Rainy',   icon: '🌧️', cls: 'badge-rainy'  },
  { label: 'Stormy',  icon: '⛈️', cls: 'badge-stormy' },
  { label: 'Windy',   icon: '🌬️', cls: 'badge-windy'  },
  { label: 'Foggy',   icon: '🌫️', cls: 'badge-foggy'  },
];

function seededRand(seed) {
  // Simple deterministic pseudo-random from seed
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function zipToNumber(zip) {
  let n = 0;
  for (let i = 0; i < zip.length; i++) n = n * 31 + zip.charCodeAt(i);
  return Math.abs(n);
}

function generateWeatherData() {
  const today = new Date();
  const data = [];
  const zipOffset = zipToNumber(currentZip);

  // today (i=0) through next 9 days (i=9)
  for (let i = 0; i <= 9; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const seed = (date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()) + zipOffset;
    const rand = seededRand(seed);

    const condIdx  = Math.floor(rand() * CONDITIONS.length);
    const high     = Math.round(15 + rand() * 20);         // 15–35 °C
    const low      = Math.round(high - 4 - rand() * 10);  // low < high
    const humidity = Math.round(40 + rand() * 55);         // 40–95 %
    const wind     = Math.round(3  + rand() * 37);         // 3–40 mph
    // current temp: midpoint shifted toward high for daytime feel
    const current  = (i === 0) ? Math.round((high + low) / 2 + rand() * 3) : null;

    data.push({ date, condition: CONDITIONS[condIdx], high, low, humidity, wind, current });
  }

  return data;
}

// ─── Special weather alerts ───────────────────────────────────────────────────
function generateAlerts(data) {
  const alerts = [];
  const today = data[0];
  const stormyDays  = data.filter(d => d.condition.label === 'Stormy').length;
  const rainyDays   = data.filter(d => d.condition.label === 'Rainy').length;
  const sunnyDays   = data.filter(d => d.condition.label === 'Sunny').length;

  if (today.condition.label === 'Stormy')
    alerts.push({ icon: '⚠️', cls: 'alert-warn',  text: 'Severe Thunderstorm Warning – Expect heavy rain and lightning today. Stay indoors if possible.' });
  if (today.condition.label === 'Foggy')
    alerts.push({ icon: '🌫️', cls: 'alert-info',  text: 'Dense Fog Advisory – Reduced visibility on roads. Drive slowly and use low-beam headlights.' });
  if (today.condition.label === 'Rainy')
    alerts.push({ icon: '🌧️', cls: 'alert-info',  text: 'Rain Advisory – Carry an umbrella. Slippery surfaces expected.' });
  if (today.wind > 25)
    alerts.push({ icon: '💨', cls: 'alert-warn',  text: `High Wind Advisory – Gusts up to ${today.wind} mph today. Secure loose outdoor items.` });
  if (today.humidity > 85)
    alerts.push({ icon: '💧', cls: 'alert-info',  text: `High Humidity Alert – ${today.humidity}% humidity. Feels significantly hotter than actual temperature.` });
  if (today.condition.label === 'Sunny' && today.high >= 30)
    alerts.push({ icon: '🌡️', cls: 'alert-warn',  text: `Heat Advisory – High of ${today.high}°C today. Stay hydrated and limit prolonged sun exposure.` });
  if (stormyDays >= 3)
    alerts.push({ icon: '⛈️', cls: 'alert-warn',  text: `Unsettled Week Ahead – ${stormyDays} storm days forecast. Keep an eye on local emergency alerts.` });
  if (rainyDays >= 4)
    alerts.push({ icon: '🌊', cls: 'alert-warn',  text: `Flood Watch – ${rainyDays} days of rain in the forecast. Low-lying areas may experience flooding.` });
  if (sunnyDays >= 7)
    alerts.push({ icon: '☀️', cls: 'alert-good',  text: `Extended Clear Skies – ${sunnyDays} sunny days ahead. Great week for outdoor activities.` });

  return alerts;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(d) {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDay(d) {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return DAY_NAMES[d.getDay()];
}

// ─── Render dashboard ─────────────────────────────────────────────────────────
function renderDashboard(username) {
  document.getElementById('logged-in-user').textContent = username;

  const weatherData = generateWeatherData();
  const todayData   = weatherData[0];

  // ── Current temperature hero ──
  document.getElementById('current-weather').innerHTML = `
    <div class="current-weather-card">
      <div class="cw-left">
        <div class="cw-icon">${todayData.condition.icon}</div>
        <div class="cw-info">
          <div class="cw-temp">${todayData.current}°C</div>
          <div class="cw-condition">${todayData.condition.label}</div>
          <div class="cw-location">${currentCity}</div>
        </div>
      </div>
      <div class="cw-right">
        <div class="cw-detail"><span class="cw-detail-label">High</span><span class="temp-high">${todayData.high}°C</span></div>
        <div class="cw-detail"><span class="cw-detail-label">Low</span><span class="temp-low">${todayData.low}°C</span></div>
        <div class="cw-detail"><span class="cw-detail-label">Humidity</span><span>${todayData.humidity}%</span></div>
        <div class="cw-detail"><span class="cw-detail-label">Wind</span><span>${todayData.wind} mph</span></div>
      </div>
    </div>
  `;

  // ── Summary cards ──
  const highs   = weatherData.map(d => d.high);
  const lows    = weatherData.map(d => d.low);
  const avgHigh = Math.round(highs.reduce((a, b) => a + b, 0) / highs.length);
  const avgLow  = Math.round(lows.reduce((a, b) => a + b, 0)  / lows.length);
  const maxTemp = Math.max(...highs);
  const minTemp = Math.min(...lows);

  const summaryCards = [
    { label: 'Avg High',  value: `${avgHigh}°C`, sub: 'Next 10 days', accent: 'card-accent-red'    },
    { label: 'Avg Low',   value: `${avgLow}°C`,  sub: 'Next 10 days', accent: 'card-accent-blue'   },
    { label: 'Peak Temp', value: `${maxTemp}°C`, sub: '10-day high',  accent: 'card-accent-purple'  },
    { label: 'Min Temp',  value: `${minTemp}°C`, sub: '10-day low',   accent: 'card-accent-green'   },
  ];

  document.getElementById('location-label').textContent = currentCity;

  document.getElementById('summary-cards').innerHTML = summaryCards.map(c => `
    <div class="summary-card ${c.accent}">
      <div class="card-label">${c.label}</div>
      <div class="card-value">${c.value}</div>
      <div class="card-sub">${c.sub}</div>
    </div>
  `).join('');

  // ── Weather alerts ──
  const alerts = generateAlerts(weatherData);
  const alertsEl = document.getElementById('weather-alerts');
  if (alerts.length) {
    alertsEl.innerHTML = `
      <div class="alerts-section">
        <div class="alerts-title">Special Weather Statements</div>
        ${alerts.map(a => `
          <div class="alert-item ${a.cls}">
            <span class="alert-icon">${a.icon}</span>
            <span class="alert-text">${a.text}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    alertsEl.innerHTML = `
      <div class="alerts-section">
        <div class="alerts-title">Special Weather Statements</div>
        <div class="alert-item alert-good">
          <span class="alert-icon">✅</span>
          <span class="alert-text">No active weather statements for this area. Conditions look normal.</span>
        </div>
      </div>
    `;
  }

  // ── Table rows ──
  const tbody = document.getElementById('weather-tbody');
  tbody.innerHTML = weatherData.map(d => {
    const barWidth = Math.round((d.humidity / 100) * 80);
    return `
      <tr>
        <td class="date-col">${formatDate(d.date)}</td>
        <td>${formatDay(d.date)}</td>
        <td>
          <span class="condition-badge ${d.condition.cls}">
            ${d.condition.icon} ${d.condition.label}
          </span>
        </td>
        <td class="temp-high">${d.high}°C</td>
        <td class="temp-low">${d.low}°C</td>
        <td>
          <div class="humidity-bar-wrap">
            <div class="humidity-bar" style="width:${barWidth}px"></div>
            <span class="humidity-val">${d.humidity}%</span>
          </div>
        </td>
        <td>${d.wind} mph</td>
      </tr>
    `;
  }).join('');
}

// ─── Page switching ───────────────────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(pageId).classList.remove('hidden');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Restore session
  const user = getSession();
  if (user) {
    renderDashboard(user);
    showPage('dashboard-page');
  } else {
    showPage('login-page');
  }

  // Login form
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl  = document.getElementById('login-error');

    if (CREDENTIALS[username] && CREDENTIALS[username] === password) {
      errorEl.classList.add('hidden');
      setSession(username);
      renderDashboard(username);
      showPage('dashboard-page');
    } else {
      errorEl.classList.remove('hidden');
    }
  });

  // Zip code change
  function applyZip() {
    const val = document.getElementById('zip-input').value.trim();
    if (!val) return;
    currentZip = val;
    currentCity = 'ZIP: ' + val;
    renderDashboard(getSession());
  }

  document.getElementById('zip-submit-btn').addEventListener('click', applyZip);
  document.getElementById('zip-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyZip();
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    showPage('login-page');
  });
});
