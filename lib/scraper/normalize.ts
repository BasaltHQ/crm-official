/**
 * Data normalization utilities for lead scraping
 * Ensures clean, consistent data across the platform
 */

// Email normalization and validation
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const trimmed = email.trim().toLowerCase();

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return null;

  // Filter disposable/temporary email domains
  const disposableDomains = [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com',
    'throwaway.email', 'mailinator.com', 'trashmail.com'
  ];

  const domain = trimmed.split('@')[1];
  if (disposableDomains.includes(domain)) return null;

  return trimmed;
}

export function isValidEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) !== null;
}

// Phone normalization to E.164 format
export function normalizePhone(phone: string | null | undefined, defaultCountryCode = '+1'): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If no country code, prepend default
  if (!cleaned.startsWith('+')) {
    cleaned = defaultCountryCode + cleaned;
  }

  // Basic validation: must have 8-15 digits after +
  const digits = cleaned.substring(1);
  if (digits.length < 8 || digits.length > 15) return null;

  return cleaned;
}

// Name normalization
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;

  const trimmed = name.trim();
  if (!trimmed) return null;

  // Normalize unicode characters
  const normalized = trimmed.normalize('NFC');

  // Remove extra whitespace
  const cleaned = normalized.replace(/\s+/g, ' ');

  // Capitalize properly
  return cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// URL normalization and canonicalization
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // Normalize protocol to https
    urlObj.protocol = 'https:';

    // Remove www prefix
    urlObj.hostname = urlObj.hostname.replace(/^www\./i, '');

    // Remove trailing slash from pathname
    urlObj.pathname = urlObj.pathname.replace(/\/+$/, '');

    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    trackingParams.forEach(param => urlObj.searchParams.delete(param));

    // Sort remaining params for consistency
    const sortedParams = Array.from(urlObj.searchParams.entries()).sort();
    urlObj.search = new URLSearchParams(sortedParams).toString();

    return urlObj.toString();
  } catch {
    return null;
  }
}

// Domain extraction and normalization
export function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;

  let cleaned = domain.trim().toLowerCase();

  // Remove protocol if present
  cleaned = cleaned.replace(/^https?:\/\//i, '');

  // Remove www prefix
  cleaned = cleaned.replace(/^www\./i, '');

  // Remove path and query string
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];

  // Basic domain validation
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/;
  if (!domainRegex.test(cleaned)) return null;

  return cleaned;
}

// Company name normalization
export function normalizeCompanyName(name: string | null | undefined): string | null {
  if (!name) return null;

  const trimmed = name.trim();
  if (!trimmed) return null;

  // Normalize unicode
  let normalized = trimmed.normalize('NFC');

  // Remove common suffixes for comparison (but keep in display name)
  const suffixes = [
    'Inc.', 'Inc', 'LLC', 'L.L.C.', 'Corp.', 'Corp', 'Corporation',
    'Ltd.', 'Ltd', 'Limited', 'Co.', 'Company', 'Group', 'GmbH', 'S.A.', 'S.L.'
  ];

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

// LinkedIn URL normalization
export function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // Must be LinkedIn domain
    if (!urlObj.hostname.includes('linkedin.com')) return null;

    // Normalize to https
    urlObj.protocol = 'https:';

    // Normalize hostname
    urlObj.hostname = 'www.linkedin.com';

    // Remove query params and hash
    urlObj.search = '';
    urlObj.hash = '';

    // Remove trailing slash
    urlObj.pathname = urlObj.pathname.replace(/\/+$/, '');

    return urlObj.toString();
  } catch {
    return null;
  }
}

// Generate deterministic dedupe keys
export function generateCompanyDedupeKey(domain: string): string {
  const normalized = normalizeDomain(domain);
  return normalized ? `company:${normalized}` : '';
}

export function generatePersonDedupeKey(
  email?: string | null,
  name?: string | null,
  companyDomain?: string | null,
  title?: string | null
): string | null {
  // Priority 1: Email (most reliable)
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    return `person:email:${normalizedEmail}`;
  }

  // Priority 2: Name + Company (good for matching)
  const normalizedName = normalizeName(name);
  const normalizedDomain = normalizeDomain(companyDomain);
  if (normalizedName && normalizedDomain) {
    const nameKey = normalizedName.toLowerCase().replace(/\s+/g, '-');
    return `person:name-company:${nameKey}@${normalizedDomain}`;
  }

  // Priority 3: Name + Title + Company (less reliable but better than nothing)
  const normalizedTitle = title?.trim().toLowerCase().replace(/\s+/g, '-');
  if (normalizedName && normalizedTitle && normalizedDomain) {
    const nameKey = normalizedName.toLowerCase().replace(/\s+/g, '-');
    return `person:name-title-company:${nameKey}:${normalizedTitle}@${normalizedDomain}`;
  }

  // No reliable key possible
  return null;
}

// Confidence scoring for data quality
export function calculateEmailConfidence(email: string | null, source: string): number {
  if (!isValidEmail(email)) return 0;

  let confidence = 50; // base confidence

  // Boost for verified sources
  if (source === 'linkedin') confidence += 30;
  else if (source === 'company-website') confidence += 20;
  else if (source === 'hunter') confidence += 25;
  else if (source === 'serp') confidence += 10;

  // Penalize generic/role-based emails
  const genericPrefixes = ['info', 'contact', 'support', 'admin', 'sales', 'help'];
  const emailPrefix = email?.split('@')[0].toLowerCase() || '';
  if (genericPrefixes.some(prefix => emailPrefix.includes(prefix))) {
    confidence -= 20;
  }

  return Math.max(0, Math.min(100, confidence));
}

export function calculatePersonConfidence(data: {
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasLinkedIn?: boolean;
  hasTitle?: boolean;
  hasName?: boolean;
  source?: string;
}): number {
  let confidence = 0;

  if (data.hasEmail) confidence += 30;
  if (data.hasPhone) confidence += 15;
  if (data.hasLinkedIn) confidence += 20;
  if (data.hasTitle) confidence += 15;
  if (data.hasName) confidence += 10;

  // Source bonus
  if (data.source === 'linkedin') confidence += 10;
  else if (data.source === 'company-website') confidence += 5;

  return Math.min(100, confidence);
}

export function calculateCompanyConfidence(data: {
  hasDomain?: boolean;
  hasWebsite?: boolean;
  hasDescription?: boolean;
  hasTechStack?: boolean;
  hasIndustry?: boolean;
  source?: string;
}): number {
  let confidence = 0;

  if (data.hasDomain) confidence += 40;
  if (data.hasWebsite) confidence += 20;
  if (data.hasDescription) confidence += 10;
  if (data.hasTechStack) confidence += 15;
  if (data.hasIndustry) confidence += 10;

  // Source bonus
  if (data.source === 'crunchbase') confidence += 5;
  else if (data.source === 'linkedin') confidence += 5;

  return Math.min(100, confidence);
}

// Additional helpers for person/company display and derivation

// Detect generic/role-based local parts like info, contact, sales, support, etc.
export function isGenericEmailLocalPart(local: string | null | undefined): boolean {
  if (!local) return false;
  const l = local.toLowerCase();
  const tokens = l.split(/[\.\+\-_]/g);
  const generics = new Set([
    'info', 'contact', 'sales', 'support', 'admin', 'help', 'hello', 'team', 'office',
    'enquiries', 'enquiry', 'marketing', 'press', 'careers'
  ]);
  if (tokens.some(t => generics.has(t))) return true;
  // Also consider exact/prefix/suffix forms like "sales-us", "info.team"
  for (const g of Array.from(generics)) {
    if (l === g || l.startsWith(g + '-') || l.startsWith(g + '.') || l.endsWith('-' + g) || l.endsWith('.' + g)) {
      return true;
    }
  }
  return false;
}

// Attempt to derive a human-friendly full name from an email address local part
export function deriveFullNameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = normalizeEmail(email) || email.trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length < 2) return null;
  const local = parts[0].replace(/\d+/g, ''); // strip numbers like jsmith23
  if (!local) return null;
  const tokens = local.split(/[\.\+\-_]/g).filter(Boolean);
  if (tokens.length === 0) return null;
  const words = tokens.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  if (words.length >= 2) return words.slice(0, 3).join(' ');
  if (words.length === 1 && words[0].length >= 2) return words[0];
  return null;
}

// Create a friendly company-like name from a domain (e.g., acme.com -> "Acme")
export function friendlyNameFromDomain(domain: string | null | undefined): string {
  const d = normalizeDomain(domain || '');
  if (!d) return 'Unknown';
  const parts = d.split('.');
  // Pick the second-level domain by default
  let sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  // Handle cases like "co.uk" where penultimate is a TLD-like token
  const tlds = new Set(['com', 'net', 'org', 'co', 'io', 'ai', 'app', 'dev', 'uk', 'us', 'de', 'cz']);
  if (parts.length >= 3 && (tlds.has(sld) || sld.length <= 2)) {
    sld = parts[parts.length - 3];
  }
  const words = sld.split(/[\-\_]/g).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const name = words.join(' ').trim() || d;
  return name;
}

// Build a safe display name for a contact, avoiding placeholders like "Direct Direct"
export function safeContactDisplayName(
  inputName: string | null | undefined,
  email?: string | null | undefined,
  companyName?: string | null | undefined,
  domain?: string | null | undefined
): string {
  const normalizedInput = normalizeName(inputName || '') || null;
  const lower = (normalizedInput || '').toLowerCase();

  // If we have a real input name and it's not a placeholder, use it
  if (normalizedInput && lower !== 'direct' && lower !== 'unknown') {
    // Collapse duplicate consecutive tokens (e.g., "John John" -> "John")
    return normalizedInput.replace(/\b(\w+)\s+\1\b/gi, '$1');
  }

  // Try to derive from email if it's not a generic/role-based local part
  if (email) {
    const local = (email.split('@')[0] || '').toLowerCase();
    if (!isGenericEmailLocalPart(local)) {
      const fromEmail = deriveFullNameFromEmail(email);
      if (fromEmail) return fromEmail;
    }
  }

  // Fallback to company name if available
  const comp = normalizeCompanyName(companyName || '') || null;
  if (comp) return comp;

  // Fallback to friendly domain
  return friendlyNameFromDomain(domain || '');
}
