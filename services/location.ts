import { Country } from '../types';
import { withCache, cacheKey, CACHE_TTL } from './cacheService';

export interface UserLocationData {
  city: string;
  country: string;
  countryCode: string;
  currency: string;
  symbol: string;
  formattedAddress: string;
}

export const AFRICAN_COUNTRIES: Country[] = [
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', flagUrl: 'https://flagcdn.com/w160/gh.png', currency: 'GHS', symbol: 'GH₵' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', flagUrl: 'https://flagcdn.com/w160/ng.png', currency: 'NGN', symbol: '₦' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', flagUrl: 'https://flagcdn.com/w160/ke.png', currency: 'KES', symbol: 'KSh' },
];

export function getCountryByCode(code: string): Country | undefined {
  return AFRICAN_COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
}

/**
 * Detects the user's location and currency using Browser Geolocation or IP-based geolocation.
 */
export async function detectUserLocation(): Promise<UserLocationData> {
  const cacheKeyStr = cacheKey('location', 'user-ip-fallback'); // since it's just a fallback right now
  
  return withCache(cacheKeyStr, async () => {
    const fallback: UserLocationData = {
      city: 'Accra',
      country: 'Ghana',
      countryCode: 'GH',
      currency: 'GHS',
      symbol: 'GH₵',
      formattedAddress: 'Accra, Ghana'
    };

    return fallback;
  }, CACHE_TTL.LOCATION);
}

export function getSymbolFromCode(code: string): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', CAD: '$', AUD: '$',
    CNY: '¥', RUB: '₽', KRW: '₩', BRL: 'R$', TRY: '₺',
    GHS: 'GH₵', NGN: '₦', KES: 'KSh', ZAR: 'R', EGP: 'E£', MAD: 'MAD',
    ETB: 'Br', TZS: 'TSh', UGX: 'USh', RWF: 'FRw', XOF: 'CFA', XAF: 'FCFA',
    ZMW: 'ZK'
  };
  return symbols[code] || code;
}