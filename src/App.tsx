// App: app-shell layout + node-client bootstrap.
// On mount: initNetwork() (node client for the persisted/default network) then
// reconnect() (restores a prior embedded session). Layout: navbar / centered
// main / footer.
import { useEffect } from "react";
import { useWallet } from "./hooks/useWallet";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { BlockPanel } from "./components/BlockPanel";
import { VerifyDialog } from "./components/VerifyDialog";
import { AccountModal } from "./components/AccountModal";

function App() {
  const { status, connector, emojiGrid, initNetwork, reconnect } = useWallet();
  // Show the connection dialog for the whole external flow: from "waiting for
  // approval" (discovery) through emoji verification, until it settles.
  const connectingExternal =
    status === "connecting" && connector === "external";

  useEffect(() => {
    initNetwork();
    // Auto-reconnect if the last session was embedded (restores the account from IndexedDB).
    void reconnect();
  }, [initNetwork, reconnect]);

  return (
    <div className={styles.shell}>
      <Navbar />

      <main className={styles.main}>
        <div className={styles.content}>
          <header className={styles.header}>
            <h1 className={styles.title}>Aztec Web Boilerplate</h1>
            <p className={styles.subtitle}>
              Connected to an Aztec node · read the live block, connect a
              wallet.
            </p>
          </header>

          <BlockPanel />
        </div>
      </main>

      <Footer />

      <VerifyDialog open={connectingExternal} emojiGrid={emojiGrid} />
      <AccountModal />
    </div>
  );
}

const styles = {
  shell: "flex min-h-screen flex-col",
  main: "flex flex-1 flex-col items-center justify-center gap-9 px-4 py-12",
  content: "flex w-full max-w-[600px] flex-col items-center gap-9",
  header: "flex flex-col items-center gap-3.5 text-center",
  title:
    "m-0 text-[2.875rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink",
  subtitle: "m-0 max-w-[34rem] text-[1.0625rem] text-ink-soft",
} as const;

export default App;
