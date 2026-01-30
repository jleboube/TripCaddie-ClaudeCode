// OpenWeatherMap integration for real weather data

interface WeatherData {
  avgHigh: number;
  avgLow: number;
  conditions: string;
  humidity: number;
  precipitation: number;
}

interface GeoLocation {
  lat: number;
  lon: number;
  name: string;
  state?: string;
  country: string;
}

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

export async function getLocationCoordinates(
  location: string
): Promise<GeoLocation | null> {
  if (!OPENWEATHER_API_KEY) {
    console.warn("OpenWeatherMap API key not configured");
    return null;
  }

  try {
    const url = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)},US&limit=1&appid=${OPENWEATHER_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Geocoding API error:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return null;
    }

    return {
      lat: data[0].lat,
      lon: data[0].lon,
      name: data[0].name,
      state: data[0].state,
      country: data[0].country,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export async function getWeatherForecast(
  lat: number,
  lon: number,
  arrivalDate: Date
): Promise<WeatherData | null> {
  if (!OPENWEATHER_API_KEY) {
    console.warn("OpenWeatherMap API key not configured");
    return null;
  }

  try {
    // Use Climate API for historical averages based on month
    // For dates within 5 days, use forecast API
    const now = new Date();
    const daysUntilArrival = Math.ceil(
      (arrivalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilArrival <= 5 && daysUntilArrival >= 0) {
      // Use 5-day forecast for near-term dates
      return await get5DayForecast(lat, lon, arrivalDate);
    } else {
      // Use historical climate data approximation
      return await getClimatologyData(lat, lon, arrivalDate);
    }
  } catch (error) {
    console.error("Weather fetch error:", error);
    return null;
  }
}

async function get5DayForecast(
  lat: number,
  lon: number,
  arrivalDate: Date
): Promise<WeatherData | null> {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    console.error("Forecast API error:", response.status);
    return null;
  }

  const data = await response.json();

  // Find forecasts for the arrival date
  const targetDate = arrivalDate.toISOString().split("T")[0];
  const dayForecasts = data.list.filter((item: { dt_txt: string }) =>
    item.dt_txt.startsWith(targetDate)
  );

  if (dayForecasts.length === 0) {
    return null;
  }

  // Calculate averages for the day
  const temps = dayForecasts.map(
    (f: { main: { temp_max: number; temp_min: number } }) => ({
      high: f.main.temp_max,
      low: f.main.temp_min,
    })
  );

  const avgHigh = Math.round(
    temps.reduce((sum: number, t: { high: number }) => sum + t.high, 0) / temps.length
  );
  const avgLow = Math.round(
    temps.reduce((sum: number, t: { low: number }) => sum + t.low, 0) / temps.length
  );

  // Get predominant weather condition
  const conditions = dayForecasts[Math.floor(dayForecasts.length / 2)].weather[0]
    .description;

  const avgHumidity = Math.round(
    dayForecasts.reduce(
      (sum: number, f: { main: { humidity: number } }) => sum + f.main.humidity,
      0
    ) / dayForecasts.length
  );

  // Precipitation probability
  const precipProb = Math.round(
    dayForecasts.reduce(
      (sum: number, f: { pop?: number }) => sum + (f.pop || 0) * 100,
      0
    ) / dayForecasts.length
  );

  return {
    avgHigh,
    avgLow,
    conditions: conditions.charAt(0).toUpperCase() + conditions.slice(1),
    humidity: avgHumidity,
    precipitation: precipProb,
  };
}

async function getClimatologyData(
  lat: number,
  lon: number,
  arrivalDate: Date
): Promise<WeatherData | null> {
  // For dates beyond 5 days, use current weather as a baseline
  // and adjust based on historical patterns
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    console.error("Current weather API error:", response.status);
    return null;
  }

  const data = await response.json();

  // Get month-based description
  const month = arrivalDate.getMonth();
  const monthDescriptions = [
    "Winter conditions, cold temperatures expected",
    "Late winter, gradually warming",
    "Early spring, variable conditions",
    "Spring weather, pleasant temperatures",
    "Late spring, warm and comfortable",
    "Early summer, warm to hot",
    "Mid-summer, hot conditions",
    "Late summer, hot and humid",
    "Early fall, cooling temperatures",
    "Fall weather, comfortable for golf",
    "Late fall, cooling rapidly",
    "Early winter, cold conditions",
  ];

  // Estimate based on current + seasonal adjustment
  const seasonalAdjust = getSeasonalAdjustment(month, lat);

  return {
    avgHigh: Math.round(data.main.temp_max + seasonalAdjust.tempAdjust),
    avgLow: Math.round(data.main.temp_min + seasonalAdjust.tempAdjust),
    conditions: monthDescriptions[month],
    humidity: data.main.humidity,
    precipitation: seasonalAdjust.precipChance,
  };
}

function getSeasonalAdjustment(
  month: number,
  lat: number
): { tempAdjust: number; precipChance: number } {
  // Basic seasonal temperature adjustments for US locations
  const isNorthern = lat > 35;

  const adjustments: Record<number, { tempAdjust: number; precipChance: number }> = {
    0: { tempAdjust: isNorthern ? -10 : -5, precipChance: 30 }, // Jan
    1: { tempAdjust: isNorthern ? -8 : -3, precipChance: 35 }, // Feb
    2: { tempAdjust: isNorthern ? -3 : 2, precipChance: 40 }, // Mar
    3: { tempAdjust: isNorthern ? 5 : 8, precipChance: 45 }, // Apr
    4: { tempAdjust: isNorthern ? 10 : 12, precipChance: 40 }, // May
    5: { tempAdjust: isNorthern ? 15 : 15, precipChance: 35 }, // Jun
    6: { tempAdjust: isNorthern ? 18 : 18, precipChance: 40 }, // Jul
    7: { tempAdjust: isNorthern ? 16 : 17, precipChance: 45 }, // Aug
    8: { tempAdjust: isNorthern ? 10 : 12, precipChance: 35 }, // Sep
    9: { tempAdjust: isNorthern ? 3 : 8, precipChance: 30 }, // Oct
    10: { tempAdjust: isNorthern ? -5 : 2, precipChance: 35 }, // Nov
    11: { tempAdjust: isNorthern ? -10 : -3, precipChance: 30 }, // Dec
  };

  return adjustments[month] || { tempAdjust: 0, precipChance: 30 };
}

export async function getWeatherForLocation(
  location: string,
  arrivalDate: Date
): Promise<WeatherData | null> {
  const coords = await getLocationCoordinates(location);
  if (!coords) {
    return null;
  }

  return getWeatherForecast(coords.lat, coords.lon, arrivalDate);
}
