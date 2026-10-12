 
const $ = id => document.getElementById(id);

const searchForm = $("searchForm");
const cityInput = $("cityInput");
const searchButton = $("searchButton");
const refreshButton = $("refreshButton");
const message = $("message");

let currentLocation = {
  name: "Kurnool",
  country: "India",
  latitude: 15.8281,
  longitude: 78.0373,
  timezone: "Asia/Kolkata"
};

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function weatherInfo(code, isDay = true) {
  if (code === 0) {
    return { icon: isDay ? "☀️" : "🌙", text: "Clear sky" };
  }
  if (code === 1) return { icon: isDay ? "🌤️" : "🌙", text: "Mainly clear" };
  if (code === 2) return { icon: "⛅", text: "Partly cloudy" };
  if (code === 3) return { icon: "☁️", text: "Overcast" };
  if ([45, 48].includes(code)) return { icon: "🌫️", text: "Foggy" };
  if ([51, 53, 55].includes(code)) return { icon: "🌦️", text: "Drizzle" };
  if ([56, 57].includes(code)) return { icon: "🌧️", text: "Freezing drizzle" };
  if ([61, 63, 65].includes(code)) return { icon: "🌧️", text: "Rain" };
  if ([66, 67].includes(code)) return { icon: "🌧️", text: "Freezing rain" };
  if ([71, 73, 75, 77].includes(code)) return { icon: "🌨️", text: "Snowfall" };
  if ([80, 81, 82].includes(code)) return { icon: "🌧️", text: "Rain showers" };
  if ([85, 86].includes(code)) return { icon: "🌨️", text: "Snow showers" };
  if (code === 95) return { icon: "⛈️", text: "Thunderstorm" };
  if ([96, 99].includes(code)) return { icon: "⛈️", text: "Thunderstorm with hail" };
  return { icon: "🌡️", text: "Weather unavailable" };
}

function formatDay(dateString, options) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    ...options
  }).format(new Date(`${dateString}T12:00:00Z`));
}

function formatLocalTime(timezone) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Weather service is unavailable. Please try again.");
  }

  return response.json();
}

async function searchCity(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({
    name: query,
    count: "8",
    language: "en",
    format: "json"
  });

  const data = await fetchJSON(url);

  if (!data.results || data.results.length === 0) {
    throw new Error("City not found. Check the spelling and try again.");
  }

  // Prefer an exact city-name match when one exists.
  const result = data.results.find(
    place => place.name.toLowerCase() === query.toLowerCase()
  ) || data.results[0];

  return {
    name: result.name,
    country: result.country || "",
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone || "auto"
  };
}

async function loadWeather(location) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");

  url.search = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "5",
    timezone: location.timezone || "auto",
    wind_speed_unit: "kmh"
  });

  const data = await fetchJSON(url);

  if (!data.current || !data.daily) {
    throw new Error("Weather data could not be read. Please try again.");
  }

  renderWeather(location, data);
}

function renderWeather(location, data) {
  const current = data.current;
  const daily = data.daily;
  const todayWeather = weatherInfo(current.weather_code, current.is_day === 1);

  $("cityName").textContent = [location.name, location.country]
    .filter(Boolean).join(", ");

  $("localTime").textContent = formatLocalTime(
    data.timezone || location.timezone || "UTC"
  );

  $("temperature").textContent = Math.round(current.temperature_2m);
  $("condition").textContent = todayWeather.text;
  $("feelsLike").textContent =
    `Feels like ${Math.round(current.apparent_temperature)}°C`;
  $("weatherArt").textContent = todayWeather.icon;

  $("humidity").textContent = `${Math.round(current.relative_humidity_2m)}%`;
  $("wind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  $("highLow").textContent =
    `${Math.round(daily.temperature_2m_max[0])}° / ${Math.round(daily.temperature_2m_min[0])}°`;

  const rain = daily.precipitation_probability_max?.[0];
  $("rainChance").textContent =
    rain == null ? "N/A" : `${Math.round(rain)}%`;

  const forecast = $("forecast");
  forecast.replaceChildren();

  daily.time.forEach((date, index) => {
    const info = weatherInfo(daily.weather_code[index]);
    const card = document.createElement("article");
    card.className = "forecast-card";
    card.style.animationDelay = `${index * 70}ms`;

    const day = document.createElement("div");
    day.className = "forecast-day";
    day.textContent = index === 0
      ? "Today"
      : formatDay(date, { weekday: "short" });

    const icon = document.createElement("div");
    icon.className = "forecast-icon";
    icon.textContent = info.icon;
    icon.setAttribute("aria-label", info.text);

    const condition = document.createElement("div");
    condition.className = "forecast-condition";
    condition.textContent = info.text;

    const temps = document.createElement("div");
    temps.className = "forecast-temps";

    const high = document.createElement("span");
    high.textContent = `${Math.round(daily.temperature_2m_max[index])}°`;

    const low = document.createElement("span");
    low.className = "low";
    low.textContent = `${Math.round(daily.temperature_2m_min[index])}°`;

    temps.append(high, low);
    card.append(day, icon, condition, temps);
    forecast.append(card);
  });
}

async function updateWeather(location, statusMessage = "Loading live weather...") {
  searchButton.disabled = true;
  refreshButton.disabled = true;
  showMessage(statusMessage);

  try {
    await loadWeather(location);
    currentLocation = location;
    showMessage("Weather updated successfully.", "success");
  } catch (error) {
    showMessage(
      error instanceof TypeError
        ? "Could not connect to the weather service. Check your internet and try again."
        : error.message,
      "error"
    );
  } finally {
    searchButton.disabled = false;
    refreshButton.disabled = false;
  }
}

searchForm.addEventListener("submit", async event => {
  event.preventDefault();

  const query = cityInput.value.trim();

  if (query.length < 2) {
    showMessage("Enter at least two letters for a city.", "error");
    cityInput.focus();
    return;
  }

  searchButton.disabled = true;
  showMessage(`Searching for ${query}...`);

  try {
    const location = await searchCity(query);
    await updateWeather(location);
  } catch (error) {
    showMessage(
      error instanceof TypeError
        ? "Could not connect. Check your internet and try again."
        : error.message,
      "error"
    );
    searchButton.disabled = false;
  }
});

refreshButton.addEventListener("click", () => {
  updateWeather(currentLocation, "Refreshing weather...");
});

// Load the default city when the page opens.
updateWeather(currentLocation);
