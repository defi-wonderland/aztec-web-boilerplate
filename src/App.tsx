// Placeholder app shell. Replaced with the full app (navbar / block panel /
// wallet flow) in the final migration step.
function App() {
  return (
    <div className={styles.shell}>
      <h1 className={styles.title}>Aztec Web Boilerplate</h1>
      <p className={styles.subtitle}>Scaffold ready.</p>
    </div>
  );
}

const styles = {
  shell: "flex min-h-screen flex-col items-center justify-center gap-3.5 px-4",
  title:
    "m-0 text-[2.875rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink",
  subtitle: "m-0 text-[1.0625rem] text-ink-soft",
} as const;

export default App;
