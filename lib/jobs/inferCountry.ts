/**
 * Heuristic country inference from a free-text location string.
 * Returns ISO 3166-1 alpha-2 codes when confident, undefined otherwise.
 *
 * Sources return inconsistent location formats:
 *   "San Francisco, CA"            -> US
 *   "Remote, India"                -> IN
 *   "London, UK"                   -> GB
 *   "Remote"                       -> undefined (no signal)
 *   "Multiple Locations"           -> undefined
 *
 * Bias: when ambiguous, we return undefined rather than guess. UI keeps
 * unknown-country jobs visible unless user explicitly asks for one country.
 */

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
]);

const US_STATE_NAMES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina',
  'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas',
  'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin',
  'Wyoming', 'District of Columbia',
];

const US_HINTS =
  /\b(usa|u\.s\.a?|united states|u\.s\.|us[- ]only|us[- ]based|americas?\b)/i;

const COUNTRY_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(india|bangalore|bengaluru|hyderabad|chennai|mumbai|delhi|noida|pune|gurugram|gurgaon|kolkata|ahmedabad)\b/i, 'IN'],
  [/\b(united kingdom|england|scotland|wales|northern ireland|london|manchester|edinburgh|glasgow|bristol|leeds|liverpool|cambridge|oxford|brighton)\b/i, 'GB'],
  [/\b(canada|canadian|toronto|vancouver|montreal|montréal|ottawa|calgary|edmonton|waterloo|quebec|québec|ontario)\b/i, 'CA'],
  [/\b(germany|german|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart)\b/i, 'DE'],
  [/\b(france|french|paris|lyon|marseille|toulouse|bordeaux|nantes|lille)\b/i, 'FR'],
  [/\b(spain|spanish|madrid|barcelona|valencia|seville|sevilla|bilbao)\b/i, 'ES'],
  [/\b(italy|italian|rome|roma|milan|milano|naples|napoli|turin|torino|bologna)\b/i, 'IT'],
  [/\b(netherlands|amsterdam|rotterdam|the hague|utrecht|eindhoven)\b/i, 'NL'],
  [/\b(ireland|irish|dublin|cork|galway)\b/i, 'IE'],
  [/\b(australia|australian|sydney|melbourne|brisbane|perth|adelaide|canberra)\b/i, 'AU'],
  [/\b(new zealand|auckland|wellington|christchurch)\b/i, 'NZ'],
  [/\b(singapore)\b/i, 'SG'],
  [/\b(japan|japanese|tokyo|osaka|kyoto|yokohama)\b/i, 'JP'],
  [/\b(brazil|brazilian|brasil|são paulo|sao paulo|rio de janeiro|brasília|brasilia)\b/i, 'BR'],
  [/\b(mexico|mexican|méxico|mexico city|guadalajara|monterrey)\b/i, 'MX'],
  [/\b(argentina|argentine|buenos aires|córdoba|cordoba)\b/i, 'AR'],
  [/\b(poland|polish|warsaw|kraków|krakow|wrocław|wroclaw|gdańsk|gdansk)\b/i, 'PL'],
  [/\b(portugal|portuguese|lisbon|porto)\b/i, 'PT'],
  [/\b(sweden|swedish|stockholm|gothenburg|göteborg|malmö|malmo)\b/i, 'SE'],
  [/\b(norway|norwegian|oslo|bergen)\b/i, 'NO'],
  [/\b(denmark|danish|copenhagen|aarhus)\b/i, 'DK'],
  [/\b(finland|finnish|helsinki)\b/i, 'FI'],
  [/\b(switzerland|swiss|zurich|zürich|geneva|genève|bern|basel|lausanne)\b/i, 'CH'],
  [/\b(austria|austrian|vienna|wien|salzburg|graz)\b/i, 'AT'],
  [/\b(belgium|belgian|brussels|bruxelles|antwerp|antwerpen|ghent|gent)\b/i, 'BE'],
  [/\b(czech|czechia|prague|praha|brno)\b/i, 'CZ'],
  [/\b(romania|romanian|bucharest|cluj)\b/i, 'RO'],
  [/\b(ukraine|ukrainian|kyiv|kiev|lviv|kharkiv)\b/i, 'UA'],
  [/\b(israel|israeli|tel aviv|jerusalem|haifa)\b/i, 'IL'],
  [/\b(turkey|turkish|istanbul|ankara|izmir)\b/i, 'TR'],
  [/\b(philippines|filipino|manila|cebu|davao)\b/i, 'PH'],
  [/\b(indonesia|indonesian|jakarta|surabaya|bali)\b/i, 'ID'],
  [/\b(vietnam|vietnamese|hanoi|ho chi minh|saigon)\b/i, 'VN'],
  [/\b(south africa|johannesburg|cape town|pretoria|durban)\b/i, 'ZA'],
  [/\b(nigeria|nigerian|lagos|abuja)\b/i, 'NG'],
  [/\b(kenya|kenyan|nairobi)\b/i, 'KE'],
  [/\b(china|chinese|beijing|shanghai|shenzhen|guangzhou|hangzhou)\b/i, 'CN'],
  [/\b(south korea|korean|seoul|busan)\b/i, 'KR'],
  [/\b(taiwan|taipei|taichung)\b/i, 'TW'],
  [/\b(hong kong)\b/i, 'HK'],
  [/\b(thailand|thai|bangkok|chiang mai)\b/i, 'TH'],
];

export function inferCountry(location: string | undefined | null): string | undefined {
  if (!location) return undefined;
  const trimmed = location.trim();
  if (trimmed.length === 0) return undefined;

  // Explicit US markers
  if (US_HINTS.test(trimmed)) return 'US';

  // US state abbreviations (case-sensitive, 2-letter)
  for (const match of trimmed.matchAll(/\b([A-Z]{2})\b/g)) {
    if (US_STATE_CODES.has(match[1])) return 'US';
  }

  // US state names
  for (const name of US_STATE_NAMES) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(trimmed)) return 'US';
  }

  // Other countries
  for (const [pattern, code] of COUNTRY_HINTS) {
    if (pattern.test(trimmed)) return code;
  }

  return undefined;
}

export const COUNTRY_LABELS: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  IN: 'India',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  IE: 'Ireland',
  AU: 'Australia',
  NZ: 'New Zealand',
  SG: 'Singapore',
  JP: 'Japan',
  BR: 'Brazil',
  MX: 'Mexico',
  AR: 'Argentina',
  PL: 'Poland',
  PT: 'Portugal',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  CH: 'Switzerland',
  AT: 'Austria',
  BE: 'Belgium',
  CZ: 'Czechia',
  RO: 'Romania',
  UA: 'Ukraine',
  IL: 'Israel',
  TR: 'Turkey',
  PH: 'Philippines',
  ID: 'Indonesia',
  VN: 'Vietnam',
  ZA: 'South Africa',
  NG: 'Nigeria',
  KE: 'Kenya',
  CN: 'China',
  KR: 'South Korea',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  TH: 'Thailand',
};
