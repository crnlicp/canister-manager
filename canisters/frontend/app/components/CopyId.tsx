import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { errorMessage } from "../lib/format";

type Props = {
  id: string;
  notify: (message: string, error?: boolean) => void;
};

export function CopyId({ id, notify }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <span className="canister-id">
      <code>{id}</code>
      <button
        className="icon-button copy-id"
        aria-label="Copy canister ID"
        title="Copy canister ID"
        onClick={(event) => {
          // Rows and tiles open details on click; copying must not.
          event.stopPropagation();
          void navigator.clipboard.writeText(id).then(
            () => {
              setCopied(true);
              notify("Canister ID copied to clipboard.");
            },
            (error) => notify(errorMessage(error), true),
          );
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </span>
  );
}
