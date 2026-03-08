'use strict';

// ─── Auth ────────────────────────────────────────────────────────────────────
const CREDENTIALS = { admin: 'password123' };

function getSession() {
  return sessionStorage.getItem('wdash_user');
}

function setSession(user) {
  sessionStorage.setItem('wdash_user', user);
}

function clearSession() {
  sessionStorage.removeItem('wdash_user');
}

// ─── Weather data (last 10 days relative to today) ───────────────────────────
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

function generateWeatherData() {
  const today = new Date();
  const data = [];

  for (let i = 9; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    // Use date as seed so data is stable on refresh
    const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    const rand = seededRand(seed);

    const condIdx  = Math.floor(rand() * CONDITIONS.length);
    const high     = Math.round(15 + rand() * 20);          // 15–35 °C
    const low      = Math.round(high - 4 - rand() * 10);   // low < high
    const humidity = Math.round(40 + rand() * 55);          // 40–95 %
    const wind     = Math.round(5  + rand() * 45);          // 5–50 km/h

    data.push({
      date,
      condition: CONDITIONS[condIdx],
      high,
      low,
      humidity,
      wind,
    });
  }

  return data;
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
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return DAY_NAMES[d.getDay()];
}

// ─── Render dashboard ─────────────────────────────────────────────────────────
function renderDashboard(username) {
  document.getElementById('logged-in-user').textContent = username;

  const weatherData = generateWeatherData();

  // Summary cards
  const highs   = weatherData.map(d => d.high);
  const lows    = weatherData.map(d => d.low);
  const avgHigh = Math.round(highs.reduce((a, b) => a + b, 0) / highs.length);
  const avgLow  = Math.round(lows.reduce((a, b) => a + b, 0)  / lows.length);
  const maxTemp = Math.max(...highs);
  const minTemp = Math.min(...lows);

  const summaryCards = [
    { label: 'Avg High',    value: `${avgHigh}°C`, sub: 'Last 10 days', accent: 'card-accent-red'    },
    { label: 'Avg Low',     value: `${avgLow}°C`,  sub: 'Last 10 days', accent: 'card-accent-blue'   },
    { label: 'Peak Temp',   value: `${maxTemp}°C`, sub: '10-day high',  accent: 'card-accent-purple'  },
    { label: 'Min Temp',    value: `${minTemp}°C`, sub: '10-day low',   accent: 'card-accent-green'   },
  ];

  const cardsContainer = document.getElementById('summary-cards');
  cardsContainer.innerHTML = summaryCards.map(c => `
    <div class="summary-card ${c.accent}">
      <div class="card-label">${c.label}</div>
      <div class="card-value">${c.value}</div>
      <div class="card-sub">${c.sub}</div>
    </div>
  `).join('');

  // Table rows
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
        <td>${d.wind} km/h</td>
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

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    showPage('login-page');
  });
});
