const SAVED_PREFIX = 'saved-';

export const toSidebarId = (address: string) => `${SAVED_PREFIX}${address}`;

export const fromSidebarId = (id: string) =>
  id.startsWith(SAVED_PREFIX) ? id.slice(SAVED_PREFIX.length) : null;
