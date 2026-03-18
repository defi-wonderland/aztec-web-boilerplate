// Emoji list for wallet avatars
const WALLET_EMOJIS = [
  '🦊',
  '🐸',
  '🦄',
  '🐙',
  '🦋',
  '🌸',
  '🍀',
  '🌈',
  '⭐',
  '🔮',
  '💎',
  '🎭',
  '🎨',
  '🎪',
  '🎯',
  '🎲',
  '🚀',
  '🌙',
  '☀️',
  '🌊',
  '🔥',
  '❄️',
  '⚡',
  '🌺',
  '🍄',
  '🌵',
  '🎸',
  '🎺',
  '🎹',
  '🥁',
  '🎧',
  '🎤',
];

/**
 * Get a consistent emoji based on wallet address
 */
export function getAddressEmoji(address: string): string {
  // Simple hash from address
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % WALLET_EMOJIS.length;
  return WALLET_EMOJIS[index];
}
