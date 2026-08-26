/**
 * Utility functions for calculating density altitude from weather data
 */

interface WeatherData {
  pressure: number | null;
  temperature: number | null;
  humidity: number | null;
  amsl: number | null;
}

/**
 * Calculate density altitude using the exact provided Python formulae
 */
export function calculateDensityAltitude(weatherData: WeatherData): number | null {
  const { pressure, temperature, humidity, amsl } = weatherData;

  if (pressure === null || temperature === null || humidity === null || amsl === null) {
    return null;
  }

  try {
    // data_df['air_pressure_derived'] = (Pressure**0.190263-(8.417286*(10**-5)*AMSL))**(1/0.190263)
    const airPressureDerived = Math.pow(
      Math.pow(pressure, 0.190263) - (8.417286 * Math.pow(10, -5) * amsl),
      1 / 0.190263
    );

    // data_df['water_vapour_derived'] = (Humidity/100)*6.1078*10**(7.5*Temp/(Temp+237.3))
    const waterVapourDerived =
      (humidity / 100) *
      6.1078 *
      Math.pow(10, (7.5 * temperature) / (temperature + 237.3));

    // data_df['air_density'] = ((air_pressure_derived*100)/(287.058*(Temp+273.15))+((water_vapour_derived*100)/(461.495*(Temp+273.15))))
    const airDensity =
      (airPressureDerived * 100) / (287.058 * (temperature + 273.15)) +
      (waterVapourDerived * 100) / (461.495 * (temperature + 273.15));

    // data_df['density_altitude'] = (44.3308-42.2665*air_density**0.234969)*1000
    const densityAltitude =
      (44.3308 - 42.2665 * Math.pow(airDensity, 0.234969)) * 1000;

    return densityAltitude;
  } catch (error) {
    console.error('Error calculating density altitude:', error);
    return null;
  }
}

/**
 * Format density altitude for display
 */
export function formatDensityAltitude(
  densityAltitude: number | null,
  decimals: number = 0
): string {
  if (densityAltitude === null) return '-';
  return densityAltitude.toFixed(decimals);
}

