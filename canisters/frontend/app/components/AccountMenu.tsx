import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, LogOut } from "lucide-react";
import { networkName } from "../lib/ic";
import { errorMessage } from "../lib/format";

type Props = {
  principal: string;
  onSignOut: () => void;
  notify: (message: string, error?: boolean) => void;
};

export function AccountMenu({ principal, onSignOut, notify }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () =>
    void navigator.clipboard.writeText(principal).then(
      () => {
        setCopied(true);
        notify("Principal copied to clipboard.");
      },
      (error) => notify(errorMessage(error), true),
    );

  return (
    <div className="account-menu" ref={root}>
      <button
        ref={trigger}
        className="account-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-avatar">II</span>
        <span>{principal.slice(0, 7)}…</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="account-popover" role="menu" aria-label="Account">
          <div className="account-popover-label">
            Signed in with Internet Identity · {networkName}
          </div>
          <div className="account-principal">
            <code title={principal}>{principal}</code>
            <button
              className="icon-button"
              role="menuitem"
              aria-label="Copy principal"
              title="Copy principal"
              onClick={copy}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <button
            className="account-signout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
