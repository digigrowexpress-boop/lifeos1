const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** 24-hex id, shape-compatible with MongoDB ObjectIds so local data can move to the cloud. */
export function newRecordId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const t = Math.floor(Date.now() / 1000);
  bytes[0] = (t >> 24) & 0xff;
  bytes[1] = (t >> 16) & 0xff;
  bytes[2] = (t >> 8) & 0xff;
  bytes[3] = t & 0xff;
  return hex(bytes);
}

/** Short id for embedded items (assessment components, milestones, topics, ...). */
export function uid(prefix = '') {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return prefix + hex(bytes);
}
