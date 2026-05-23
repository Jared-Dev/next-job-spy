/**
 * Stable, synchronous 53-bit hash for cache keys. cyrb53 by bryc.
 * https://stackoverflow.com/a/52171480
 */
export function cyrb53(input: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export function hashTailorInputs(parts: {
  profile: unknown;
  jobDescription: string;
  jobTitle: string;
  templateId: string;
  model: string;
  directive: string;
}): string {
  return cyrb53(
    `${parts.templateId}|${parts.model}|${parts.jobTitle}|${parts.jobDescription}|${parts.directive}|${JSON.stringify(parts.profile)}`,
  );
}

export function hashCoverLetterInputs(parts: {
  profile: unknown;
  jobDescription: string;
  jobTitle: string;
  resumeContext: string;
  model: string;
  directive: string;
}): string {
  return cyrb53(
    `cover|${parts.model}|${parts.jobTitle}|${parts.jobDescription}|${parts.resumeContext}|${parts.directive}|${JSON.stringify(parts.profile)}`,
  );
}
