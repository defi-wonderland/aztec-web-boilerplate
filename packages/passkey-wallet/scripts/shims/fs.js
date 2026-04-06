export const existsSync = () => false;
export const readFileSync = () => { throw new Error('fs not available in browser'); };
export const writeFileSync = () => { throw new Error('fs not available in browser'); };
export const mkdirSync = () => { throw new Error('fs not available in browser'); };
export const mkdir = () => Promise.reject(new Error('fs/promises not available in browser'));
export const writeFile = () => Promise.reject(new Error('fs/promises not available in browser'));
export const readFile = () => Promise.reject(new Error('fs/promises not available in browser'));
export const rm = () => Promise.reject(new Error('fs/promises not available in browser'));
export default { existsSync, readFileSync, writeFileSync, mkdirSync, mkdir, writeFile, readFile, rm };
