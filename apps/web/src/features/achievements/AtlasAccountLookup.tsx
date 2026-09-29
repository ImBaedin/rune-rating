import { ArrowRight, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import type { AtlasAccount } from "./useAtlasAccount";
export function AtlasAccountLookup({ account }: { account: AtlasAccount }) {
  const [draft, setDraft] = useState(account.rsn ?? "");
  const busy = account.refreshing;
  return (
    <div className="atlas-account-lookup">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void account.lookup(draft);
        }}
      >
        <label className="atlas-sr-only" htmlFor="atlas-account-rsn">
          RuneScape name
        </label>
        <input
          id="atlas-account-rsn"
          name="rsn"
          placeholder="RuneScape name"
          value={draft}
          maxLength={12}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={account.requesting || !draft.trim()}
          aria-label="Look up account"
        >
          <ArrowRight size={16} />
        </button>
        {account.rsn && (
          <button
            type="button"
            disabled={busy || account.coolingDown}
            aria-label="Refresh account"
            aria-describedby={
              account.coolingDown && !busy
                ? "atlas-refresh-cooldown"
                : undefined
            }
            onClick={() => {
              if (account.rsn) void account.lookup(account.rsn);
            }}
          >
            <RefreshCw size={14} />
          </button>
        )}
        {account.rsn && (
          <button
            type="button"
            aria-label="Explore sample atlas"
            onClick={account.explore}
          >
            <X size={14} />
          </button>
        )}
      </form>
      <p
        role="status"
        data-error={
          !!account.error ||
          account.progress?.availability === "requiresRuneProfile"
        }
      >
        {account.message}
      </p>
      {account.coolingDown && !busy && (
        <p id="atlas-refresh-cooldown">
          Next refresh available at{" "}
          {new Date(account.refreshAllowedAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
          .
        </p>
      )}
    </div>
  );
}
