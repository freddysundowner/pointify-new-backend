import { useMemo } from "react";
import { Keyboard } from "lucide-react";

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent);
}

interface Shortcut {
  keys: string[];
  label: string;
}

export default function ShortcutsBar() {
  const mod = useMemo(() => (isMac() ? "⌘" : "Ctrl"), []);

  const shortcuts: Shortcut[] = [
    { keys: [mod, "F"], label: "Search" },
    { keys: [mod, "K"], label: "Calculator" },
    { keys: [mod, "Enter"], label: "Pay" },
    { keys: [mod, "⌫"], label: "Clear Cart" },
    { keys: ["Esc"], label: "Clear Search" },
  ];

  return (
    <>
      <span className="flex items-center gap-1 font-medium text-gray-400 shrink-0">
        <Keyboard className="h-3 w-3" />
        Shortcuts:
      </span>
      {shortcuts.map(({ keys, label }) => (
        <span key={label} className="flex items-center gap-1">
          <span className="flex items-center gap-0.5">
            {keys.map((k, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <kbd className="inline-flex items-center justify-center rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-600 shadow-sm leading-none">
                  {k}
                </kbd>
                {i < keys.length - 1 && <span className="text-gray-300">+</span>}
              </span>
            ))}
          </span>
          <span className="text-gray-400">{label}</span>
        </span>
      ))}
    </>
  );
}
