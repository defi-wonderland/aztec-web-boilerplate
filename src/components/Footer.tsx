// Footer: simple bottom bar with centered credit text.
export function Footer() {
  return (
    <footer className={styles.bar}>
      <span>
        Made by{' '}
        <a href="https://wonderland.xyz/" target="_blank" rel="noreferrer" className={styles.link}>
          Wonderland
        </a>{' '}
        with 💜
      </span>
    </footer>
  );
}

const styles = {
  bar: 'flex h-[60px] w-full items-center justify-center border-t border-line px-6 text-center text-sm text-ink-dim',
  link: 'font-medium text-violet-400 transition-colors hover:text-violet-300',
} as const;
