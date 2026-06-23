type WeatherPageProps = {
  searchParams: Promise<{
    city?: string
  }>
}

type GeocodingResponse = {
  results?: Array<{
    name: string
    country: string
    admin1?: string
    latitude: number
    longitude: number
  }>
}

type ForecastResponse = {
  current?: {
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    weather_code: number
  }
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weather_code: number[]
  }
}

type WeatherSnapshot = {
  locationLabel: string
  current: NonNullable<ForecastResponse["current"]>
  daily: Array<{
    date: string
    max: number
    min: number
    code: number
  }>
}

const DEFAULT_CITY = "London"

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00Z`))
}

function roundTemperature(value: number) {
  return `${Math.round(value)}°C`
}

function describeWeatherCode(code: number) {
  switch (code) {
    case 0:
      return "Clear sky"
    case 1:
    case 2:
    case 3:
      return "Partly cloudy"
    case 45:
    case 48:
      return "Fog"
    case 51:
    case 53:
    case 55:
      return "Drizzle"
    case 61:
    case 63:
    case 65:
      return "Rain"
    case 66:
    case 67:
      return "Freezing rain"
    case 71:
    case 73:
    case 75:
      return "Snow"
    case 77:
      return "Snow grains"
    case 80:
    case 81:
    case 82:
      return "Rain showers"
    case 85:
    case 86:
      return "Snow showers"
    case 95:
      return "Thunderstorm"
    case 96:
    case 99:
      return "Thunderstorm with hail"
    default:
      return "Variable conditions"
  }
}

async function fetchWeather(city: string): Promise<WeatherSnapshot | null> {
  const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search")
  geocodingUrl.searchParams.set("name", city)
  geocodingUrl.searchParams.set("count", "1")
  geocodingUrl.searchParams.set("language", "en")
  geocodingUrl.searchParams.set("format", "json")

  const geocodingResponse = await fetch(geocodingUrl, { cache: "no-store" })
  if (!geocodingResponse.ok) {
    throw new Error("Unable to geocode requested city")
  }

  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse
  const location = geocodingData.results?.[0]
  if (!location) {
    return null
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast")
  forecastUrl.searchParams.set("latitude", String(location.latitude))
  forecastUrl.searchParams.set("longitude", String(location.longitude))
  forecastUrl.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code")
  forecastUrl.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min")
  forecastUrl.searchParams.set("forecast_days", "5")
  forecastUrl.searchParams.set("timezone", "auto")

  const forecastResponse = await fetch(forecastUrl, { cache: "no-store" })
  if (!forecastResponse.ok) {
    throw new Error("Unable to load weather forecast")
  }

  const forecastData = (await forecastResponse.json()) as ForecastResponse
  if (!forecastData.current || !forecastData.daily) {
    throw new Error("Weather forecast response was incomplete")
  }

  return {
    locationLabel: [location.name, location.admin1, location.country].filter(Boolean).join(", "),
    current: forecastData.current,
    daily: forecastData.daily.time.map((date, index) => ({
      date,
      max: forecastData.daily?.temperature_2m_max[index] ?? 0,
      min: forecastData.daily?.temperature_2m_min[index] ?? 0,
      code: forecastData.daily?.weather_code[index] ?? 0,
    })),
  }
}

export default async function WeatherPage({ searchParams }: WeatherPageProps) {
  const { city = DEFAULT_CITY } = await searchParams
  const trimmedCity = city.trim() || DEFAULT_CITY

  let weather: WeatherSnapshot | null = null
  let errorMessage: string | null = null

  try {
    weather = await fetchWeather(trimmedCity)
  } catch {
    errorMessage = "Weather data is unavailable right now. Please try again in a moment."
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_38%,#f8fafc_100%)] px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="brand-shell-surface px-5 py-6 text-white md:px-8 md:py-8">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
              <span className="rounded-full bg-white/12 px-3 py-1">Forecast</span>
              <span>Live weather search</span>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">Weather by city</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-200 md:text-base">
              Check current conditions and a short outlook before heading out to a viewing.
            </p>

            <form action="/weather" method="get" className="mt-6 flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-white/10 p-3 backdrop-blur md:flex-row md:items-center md:p-4">
              <input
                type="search"
                name="city"
                defaultValue={trimmedCity}
                placeholder="Enter a city"
                className="w-full rounded-xl border border-white/20 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400"
              />
              <button type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                Search weather
              </button>
            </form>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-5 md:px-8 md:py-6">
            <div className="text-sm font-semibold text-slate-900">Showing forecast for {trimmedCity}</div>
            <div className="mt-1 text-sm text-slate-500">Powered by Open-Meteo geocoding and forecast data.</div>
          </div>
        </section>

        {errorMessage ? (
          <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-amber-950">Weather lookup failed</h2>
            <p className="mt-2 text-sm text-amber-900">{errorMessage}</p>
          </section>
        ) : !weather ? (
          <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">No city matched that search</h2>
            <p className="mt-3 text-sm text-slate-600">
              Try a larger nearby town or use a simpler city name.
            </p>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_14px_48px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Current conditions</div>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{weather.locationLabel}</h2>
                  <p className="mt-2 text-sm text-slate-600">{describeWeatherCode(weather.current.weather_code)}</p>
                </div>
                <div className="text-left md:text-right">
                  <div className="text-5xl font-bold tracking-tight text-slate-950">{roundTemperature(weather.current.temperature_2m)}</div>
                  <div className="mt-2 text-sm text-slate-500">Feels like {roundTemperature(weather.current.apparent_temperature)}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Humidity</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{weather.current.relative_humidity_2m}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Wind</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{Math.round(weather.current.wind_speed_10m)} km/h</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Outlook</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">5 days</div>
                </div>
              </div>
            </div>

            <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next days</div>
              <div className="mt-4 space-y-3">
                {weather.daily.map((day) => (
                  <div key={day.date} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{formatDayLabel(day.date)}</div>
                        <div className="mt-1 text-xs text-slate-500">{describeWeatherCode(day.code)}</div>
                      </div>
                      <div className="text-right text-sm font-medium text-slate-700">
                        <div>{roundTemperature(day.max)}</div>
                        <div className="text-slate-500">{roundTemperature(day.min)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </section>
        )}
      </div>
    </div>
  )
}