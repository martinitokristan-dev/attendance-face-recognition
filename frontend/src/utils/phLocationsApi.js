/**
 * Philippine Standard Geographic Code (PSGC) API Service
 * Fetches dynamic, real-time Philippine Regions, Provinces, and Cities/Municipalities.
 * Uses official PSGC API (https://psgc.gitlab.io/api/) with in-memory caching and offline fallback.
 */

const PSGC_BASE_URL = 'https://psgc.gitlab.io/api';

const cache = {
  regions: null,
  provinces: {},
  cities: {},
};

// Fallback regions in case of offline/network issues
const FALLBACK_REGIONS = [
  { code: '160000000', name: 'Caraga', regionName: 'Region XIII' },
  { code: '100000000', name: 'Northern Mindanao', regionName: 'Region X' },
  { code: '110000000', name: 'Davao Region', regionName: 'Region XI' },
  { code: '120000000', name: 'SOCCSKSARGEN', regionName: 'Region XII' },
  { code: '130000000', name: 'National Capital Region', regionName: 'NCR' },
  { code: '010000000', name: 'Ilocos Region', regionName: 'Region I' },
  { code: '020000000', name: 'Cagayan Valley', regionName: 'Region II' },
  { code: '030000000', name: 'Central Luzon', regionName: 'Region III' },
  { code: '040000000', name: 'CALABARZON', regionName: 'Region IV-A' },
  { code: '170000000', name: 'MIMAROPA', regionName: 'MIMAROPA' },
  { code: '050000000', name: 'Bicol Region', regionName: 'Region V' },
  { code: '060000000', name: 'Western Visayas', regionName: 'Region VI' },
  { code: '070000000', name: 'Central Visayas', regionName: 'Region VII' },
  { code: '080000000', name: 'Eastern Visayas', regionName: 'Region VIII' },
  { code: '090000000', name: 'Zamboanga Peninsula', regionName: 'Region IX' },
  { code: '140000000', name: 'Cordillera Administrative Region', regionName: 'CAR' },
  { code: '190000000', name: 'Bangsamoro Autonomous Region in Muslim Mindanao', regionName: 'BARMM' },
];

export async function getRegions() {
  if (cache.regions) return cache.regions;
  try {
    const res = await fetch(`${PSGC_BASE_URL}/regions.json`);
    if (!res.ok) throw new Error('Failed to fetch regions');
    const data = await res.json();
    // Sort so Region XIII (Caraga) is prioritized or natural order
    const formatted = data.map((r) => ({
      code: r.code,
      name: r.name,
      regionName: r.regionName,
      displayName: r.regionName ? `${r.regionName} (${r.name})` : r.name,
    }));
    cache.regions = formatted;
    return formatted;
  } catch (err) {
    console.warn('Using fallback regions due to network:', err);
    return FALLBACK_REGIONS.map((r) => ({
      ...r,
      displayName: `${r.regionName} (${r.name})`,
    }));
  }
}

export async function getProvinces(regionCode) {
  if (!regionCode) return [];
  if (cache.provinces[regionCode]) return cache.provinces[regionCode];

  try {
    const res = await fetch(`${PSGC_BASE_URL}/regions/${regionCode}/provinces.json`);
    if (!res.ok) throw new Error('Failed to fetch provinces');
    const data = await res.json();
    const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
    cache.provinces[regionCode] = sorted;
    return sorted;
  } catch (err) {
    console.warn('Failed to load provinces from API:', err);
    if (regionCode === '160000000') {
      return [
        { code: '160200000', name: 'Agusan Del Norte' },
        { code: '160300000', name: 'Agusan Del Sur' },
        { code: '166700000', name: 'Surigao Del Norte' },
        { code: '166800000', name: 'Surigao Del Sur' },
        { code: '168500000', name: 'Dinagat Islands' },
      ];
    }
    return [];
  }
}

export async function getCitiesMunicipalities(regionCode, provinceCode) {
  if (!regionCode && !provinceCode) return [];
  const cacheKey = `${regionCode}_${provinceCode || 'direct'}`;
  if (cache.cities[cacheKey]) return cache.cities[cacheKey];

  try {
    let url;
    if (provinceCode) {
      url = `${PSGC_BASE_URL}/provinces/${provinceCode}/cities-municipalities.json`;
    } else {
      // Regions like NCR that don't have provinces
      url = `${PSGC_BASE_URL}/regions/${regionCode}/cities-municipalities.json`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch cities/municipalities');
    const data = await res.json();
    const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
    cache.cities[cacheKey] = sorted;
    return sorted;
  } catch (err) {
    console.warn('Failed to load cities/municipalities from API:', err);
    if (provinceCode === '160200000' || regionCode === '160000000') {
      return [
        { code: '160202000', name: 'City of Butuan' },
        { code: '160201000', name: 'Buenavista' },
        { code: '160203000', name: 'City of Cabadbaran' },
        { code: '160204000', name: 'Carmen' },
        { code: '160205000', name: 'Jabonga' },
        { code: '160206000', name: 'Kitcharao' },
        { code: '160207000', name: 'Las Nieves' },
        { code: '160208000', name: 'Magallanes' },
        { code: '160209000', name: 'Nasipit' },
        { code: '160210000', name: 'Remedios T. Romualdez' },
        { code: '160211000', name: 'Santiago' },
        { code: '160212000', name: 'Tubay' },
      ];
    }
    return [];
  }
}
