import { useEffect, useState } from "react";
import { Moon, RefreshCcw, Sun } from "lucide-react";

type DashboardHeaderProps = {
  walletAddress?: string | null;
  walletBusy?: boolean;
  onWalletConnect?: () => Promise<void>;
  onWalletDisconnect?: () => Promise<void>;
  onWalletRefresh?: () => Promise<void>;
};

function shortAddress(value?: string | null): string {
  if (!value) return "";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function DashboardHeader({
  walletAddress,
  walletBusy = false,
  onWalletConnect,
  onWalletDisconnect,
  onWalletRefresh
}: DashboardHeaderProps) {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("autarch-theme");
    const light = saved === "light";
    setIsLight(light);
    document.body.classList.toggle("light", light);
  }, []);

  const toggleTheme = () => {
    setIsLight((prev) => {
      const next = !prev;
      localStorage.setItem("autarch-theme", next ? "light" : "dark");
      document.body.classList.toggle("light", next);
      return next;
    });
  };

  return (
    <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0f0f11]/80 backdrop-blur-md sticky top-0 z-10">
      <div>
        <h2 className="text-base font-bold text-white uppercase tracking-tight">Dashboard</h2>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 skeuo-button text-[10px] font-bold text-zinc-400 hover:text-white transition-colors uppercase"
          onClick={() => {
            if (onWalletRefresh) {
              void onWalletRefresh();
              return;
            }
            window.location.reload();
          }}
        >
          <RefreshCcw className="w-3 h-3" />
          <span>refresh</span>
        </button>
        <button
          type="button"
          className="px-3 py-1.5 skeuo-button text-[10px] font-bold text-zinc-400 hover:text-white transition-colors uppercase disabled:opacity-50"
          disabled={walletBusy}
          onClick={() => {
            if (walletAddress) {
              if (onWalletDisconnect) void onWalletDisconnect();
              return;
            }
            if (onWalletConnect) void onWalletConnect();
          }}
        >
          {walletAddress ? `wallet ${shortAddress(walletAddress)}` : "connect wallet"}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 skeuo-button text-zinc-400 hover:text-white transition-colors"
        >
          {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
