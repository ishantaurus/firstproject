'use strict';

// ─── Auth ────────────────────────────────────────────────────────────────────
const CREDENTIALS = { admin: 'password123' };
let currentZip    = '10001';
let currentCity   = 'New York City, NY';
let currentUnit   = 'C';          // 'C' or 'F'
let cachedWeather = null;          // last successful API result

function getSession()      { return sessionStorage.getItem('wdash_user'); }
function setSession(user)  { sessionStorage.setItem('wdash_user', user); }
function clearSession()    { sessionStorage.removeItem('wdash_user'); }

// ─── Temperature unit helpers ─────────────────────────────────────────────────
function toDisplay(celsius) {
  return currentUnit === 'F' ? Math.round(celsius * 9 / 5 + 32) : celsius;
}

function unitLabel() {
  return currentUnit === 'F' ? '°F' : '°C';
}

// ─── Conditions (mapped from WMO weather codes) ───────────────────────────────
const CONDITIONS = {
  sunny:  { label: 'Sunny',   icon: '☀️',  cls: 'badge-sunny'  },
  cloudy: { label: 'Cloudy',  icon: '☁️',  cls: 'badge-cloudy' },
  rainy:  { label: 'Rainy',   icon: '🌧️', cls: 'badge-rainy'  },
  stormy: { label: 'Stormy',  icon: '⛈️', cls: 'badge-stormy' },
  windy:  { label: 'Windy',   icon: '🌬️', cls: 'badge-windy'  },
  foggy:  { label: 'Foggy',   icon: '🌫️', cls: 'badge-foggy'  },
  snowy:  { label: 'Snowy',   icon: '❄️',  cls: 'badge-snowy'  },
};

// WMO Weather Interpretation Codes → condition
function wmoToCondition(code, windMph) {
  if (code === 0)                                          return CONDITIONS.sunny;
  if (code <= 3)                                           return windMph > 35 ? CONDITIONS.windy : CONDITIONS.cloudy;
  if (code === 45 || code === 48)                          return CONDITIONS.foggy;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CONDITIONS.rainy;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CONDITIONS.snowy;
  if (code >= 95)                                          return CONDITIONS.stormy;
  return CONDITIONS.cloudy;
}

// ─── Real weather API (Open-Meteo + Zippopotam.us) ───────────────────────────
async function fetchWeatherByZip(zip) {
  // 1. Zip → lat/lon + city name  (Zippopotam.us, same geocoding Apple uses for US zips)
  const geoRes = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`);
  if (!geoRes.ok) throw new Error(`ZIP code "${zip}" not found. Please enter a valid US zip.`);
  const geoData = await geoRes.json();
  const place   = geoData.places[0];
  const lat     = parseFloat(place.latitude);
  const lon     = parseFloat(place.longitude);
  const city    = `${place['place name']}, ${place['state abbreviation']}`;

  // 2. Weather from Open-Meteo (uses ECMWF/GFS models — same source as Apple WeatherKit)
  const params = new URLSearchParams({
    latitude:        lat,
    longitude:       lon,
    current_weather: true,
    daily: [
      'weathercode',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'windspeed_10m_max',
      'apparent_temperature_max',
    ].join(','),
    wind_speed_unit: 'mph',
    timezone:        'auto',
    forecast_days:   10,
  });

  const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!wxRes.ok) throw new Error('Weather service unavailable. Please try again.');
  const wx = await wxRes.json();

  const current = wx.current_weather;
  const daily   = wx.daily;

  const data = daily.time.map((dateStr, i) => {
    const wind = Math.round(daily.windspeed_10m_max[i]);
    return {
      date:      new Date(dateStr + 'T12:00:00'),
      condition: wmoToCondition(daily.weathercode[i], wind),
      high:      Math.round(daily.temperature_2m_max[i]),
      low:       Math.round(daily.temperature_2m_min[i]),
      feelsLike: Math.round(daily.apparent_temperature_max[i]),
      precip:    daily.precipitation_probability_max[i] ?? 0,
      wind,
      current:   i === 0 ? Math.round(current.temperature) : null,
    };
  });

  return { data, city };
}

// ─── Special weather alerts ───────────────────────────────────────────────────
function generateAlerts(data) {
  const alerts = [];
  const today      = data[0];
  const stormyDays = data.filter(d => d.condition.label === 'Stormy').length;
  const rainyDays  = data.filter(d => d.condition.label === 'Rainy').length;
  const snowyDays  = data.filter(d => d.condition.label === 'Snowy').length;
  const sunnyDays  = data.filter(d => d.condition.label === 'Sunny').length;

  if (today.condition.label === 'Stormy')
    alerts.push({ icon: '⚠️', cls: 'alert-warn', text: 'Severe Thunderstorm Warning – Expect heavy rain and lightning today. Stay indoors if possible.' });
  if (today.condition.label === 'Foggy')
    alerts.push({ icon: '🌫️', cls: 'alert-info', text: 'Dense Fog Advisory – Reduced visibility on roads. Use low-beam headlights and drive slowly.' });
  if (today.condition.label === 'Rainy')
    alerts.push({ icon: '🌧️', cls: 'alert-info', text: 'Rain Advisory – Carry an umbrella. Slippery surfaces expected.' });
  if (today.condition.label === 'Snowy')
    alerts.push({ icon: '❄️', cls: 'alert-info', text: 'Winter Weather Advisory – Snow expected today. Allow extra travel time and use caution on roads.' });
  if (today.wind > 25)
    alerts.push({ icon: '💨', cls: 'alert-warn', text: `High Wind Advisory – Winds up to ${today.wind} mph today. Secure loose outdoor items.` });
  if (today.precip > 80)
    alerts.push({ icon: '💧', cls: 'alert-info', text: `High Precipitation Chance – ${today.precip}% chance of rain today. Plan accordingly.` });
  if (today.condition.label === 'Sunny' && today.high >= 30)
    alerts.push({ icon: '🌡️', cls: 'alert-warn', text: `Heat Advisory – High of ${today.high}°C today. Stay hydrated and limit sun exposure.` });
  if (stormyDays >= 3)
    alerts.push({ icon: '⛈️', cls: 'alert-warn', text: `Unsettled Week Ahead – ${stormyDays} storm days in the 10-day forecast. Monitor local alerts.` });
  if (rainyDays >= 4)
    alerts.push({ icon: '🌊', cls: 'alert-warn', text: `Flood Watch – ${rainyDays} rainy days forecast. Low-lying areas may experience flooding.` });
  if (snowyDays >= 3)
    alerts.push({ icon: '🌨️', cls: 'alert-info', text: `Extended Winter Conditions – ${snowyDays} snowy days ahead. Keep roads and walkways clear.` });
  if (sunnyDays >= 7)
    alerts.push({ icon: '☀️', cls: 'alert-good', text: `Extended Clear Skies – ${sunnyDays} sunny days ahead. Great week for outdoor activities.` });

  return alerts;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
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

function showLoadingState() {
  document.getElementById('current-weather').innerHTML = `
    <div class="current-weather-card loading-card">
      <div class="loading-spinner"></div>
      <span class="loading-text">Fetching live weather data…</span>
    </div>
  `;
  document.getElementById('summary-cards').innerHTML = '';
  document.getElementById('weather-alerts').innerHTML = '';
  document.getElementById('weather-tbody').innerHTML = '';
}

function showErrorState(msg) {
  document.getElementById('current-weather').innerHTML = `
    <div class="current-weather-card error-card">
      <span class="error-icon">⚠️</span>
      <span class="error-text">${msg}</span>
    </div>
  `;
}

// ─── Render weather UI (no fetch — uses cached data) ─────────────────────────
function renderWeatherUI(weatherData) {
  const ul     = unitLabel();
  const todayData = weatherData[0];

  // ── Current temperature hero ──
  document.getElementById('current-weather').innerHTML = `
    <div class="current-weather-card">
      <div class="cw-left">
        <div class="cw-icon">${todayData.condition.icon}</div>
        <div class="cw-info">
          <div class="cw-temp">${toDisplay(todayData.current)}${ul}</div>
          <div class="cw-condition">${todayData.condition.label}</div>
          <div class="cw-location">${currentCity}</div>
        </div>
      </div>
      <div class="cw-right">
        <div class="cw-detail"><span class="cw-detail-label">High</span><span class="temp-high">${toDisplay(todayData.high)}${ul}</span></div>
        <div class="cw-detail"><span class="cw-detail-label">Low</span><span class="temp-low">${toDisplay(todayData.low)}${ul}</span></div>
        <div class="cw-detail"><span class="cw-detail-label">Feels Like</span><span>${toDisplay(todayData.feelsLike)}${ul}</span></div>
        <div class="cw-detail"><span class="cw-detail-label">Wind</span><span>${todayData.wind} mph</span></div>
      </div>
    </div>
  `;

  // ── Summary cards ──
  const highs   = weatherData.map(d => d.high);
  const lows    = weatherData.map(d => d.low);
  const avgHigh = toDisplay(Math.round(highs.reduce((a, b) => a + b, 0) / highs.length));
  const avgLow  = toDisplay(Math.round(lows.reduce((a, b) => a + b, 0)  / lows.length));
  const maxTemp = toDisplay(Math.max(...highs));
  const minTemp = toDisplay(Math.min(...lows));

  document.getElementById('location-label').textContent = currentCity;

  document.getElementById('summary-cards').innerHTML = [
    { label: 'Avg High',  value: `${avgHigh}${ul}`, sub: 'Next 10 days', accent: 'card-accent-red'    },
    { label: 'Avg Low',   value: `${avgLow}${ul}`,  sub: 'Next 10 days', accent: 'card-accent-blue'   },
    { label: 'Peak Temp', value: `${maxTemp}${ul}`, sub: '10-day high',  accent: 'card-accent-purple'  },
    { label: 'Min Temp',  value: `${minTemp}${ul}`, sub: '10-day low',   accent: 'card-accent-green'   },
  ].map(c => `
    <div class="summary-card ${c.accent}">
      <div class="card-label">${c.label}</div>
      <div class="card-value">${c.value}</div>
      <div class="card-sub">${c.sub}</div>
    </div>
  `).join('');

  // ── Weather alerts ──
  const alerts    = generateAlerts(weatherData);
  const alertsEl  = document.getElementById('weather-alerts');
  const alertRows = alerts.length
    ? alerts.map(a => `
        <div class="alert-item ${a.cls}">
          <span class="alert-icon">${a.icon}</span>
          <span class="alert-text">${a.text}</span>
        </div>`).join('')
    : `<div class="alert-item alert-good">
         <span class="alert-icon">✅</span>
         <span class="alert-text">No active weather statements. Conditions look normal for this area.</span>
       </div>`;
  alertsEl.innerHTML = `
    <div class="alerts-section">
      <div class="alerts-title">Special Weather Statements</div>
      ${alertRows}
    </div>`;

  // ── Table headers ──
  document.getElementById('th-high').textContent = `High (${ul})`;
  document.getElementById('th-low').textContent  = `Low (${ul})`;

  // ── Table rows ──
  document.getElementById('weather-tbody').innerHTML = weatherData.map(d => {
    const barWidth = Math.round((d.precip / 100) * 80);
    return `
      <tr>
        <td class="date-col">${formatDate(d.date)}</td>
        <td>${formatDay(d.date)}</td>
        <td>
          <span class="condition-badge ${d.condition.cls}">
            ${d.condition.icon} ${d.condition.label}
          </span>
        </td>
        <td class="temp-high">${toDisplay(d.high)}${ul}</td>
        <td class="temp-low">${toDisplay(d.low)}${ul}</td>
        <td>
          <div class="humidity-bar-wrap">
            <div class="humidity-bar" style="width:${barWidth}px"></div>
            <span class="humidity-val">${d.precip}%</span>
          </div>
        </td>
        <td>${d.wind} mph</td>
      </tr>`;
  }).join('');
}

// ─── Render dashboard (fetch + render) ───────────────────────────────────────
async function renderDashboard(username) {
  document.getElementById('logged-in-user').textContent = username;
  showLoadingState();

  try {
    const result = await fetchWeatherByZip(currentZip);
    cachedWeather = result;
    currentCity   = result.city;
    renderWeatherUI(result.data);
  } catch (err) {
    showErrorState(err.message);
  }
}

// ─── Page switching ───────────────────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(pageId).classList.remove('hidden');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const user = getSession();
  if (user) {
    showPage('dashboard-page');
    renderDashboard(user);
  } else {
    showPage('login-page');
  }

  // Login
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl  = document.getElementById('login-error');
    if (CREDENTIALS[username] && CREDENTIALS[username] === password) {
      errorEl.classList.add('hidden');
      setSession(username);
      showPage('dashboard-page');
      renderDashboard(username);
    } else {
      errorEl.classList.remove('hidden');
    }
  });

  // Unit toggle
  document.getElementById('unit-toggle-btn').addEventListener('click', () => {
    currentUnit = currentUnit === 'C' ? 'F' : 'C';
    document.getElementById('unit-toggle-btn').textContent = currentUnit === 'C' ? '°C' : '°F';
    if (cachedWeather) renderWeatherUI(cachedWeather.data);
  });

  // Zip code
  async function applyZip() {
    const val = document.getElementById('zip-input').value.trim();
    if (!val) return;
    currentZip = val;
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
