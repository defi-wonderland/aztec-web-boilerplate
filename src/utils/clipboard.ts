export const copyToClipboard = async (text: string | undefined): Promise<boolean> => {
  if (!text) return false;
  
  try {
    // Ensure we have the proper format with 0x prefix for addresses
    const textToCopy = text.startsWith('0x') || !isHexString(text) ? text : `0x${text}`;
    
    await navigator.clipboard.writeText(textToCopy);
    console.log('Copied to clipboard:', textToCopy);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
};

// Helper to check if a string looks like a hex address
const isHexString = (str: string): boolean => {
  return /^[0-9a-fA-F]+$/.test(str);
};