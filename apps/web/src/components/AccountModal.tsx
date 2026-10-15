import { useState, type FormEvent } from "react";
import { X, Moon, Sun, Check, LogOut, Cpu } from "lucide-react";

type AccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string | null;
  onUpdateUser: (email: string | null) => void;
  theme: "light" | "zinc";
  onToggleTheme: (theme: "light" | "zinc") => void;
  workspaceCount: number;
};

export function AccountModal({
  isOpen,
  onClose,
  userEmail,
  onUpdateUser,
  theme,
  onToggleTheme,
  workspaceCount,
}: AccountModalProps) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(userEmail ?? "");

  if (!isOpen) return null;

  const displayName = userEmail ? userEmail.split("@")[0] : "Souradeep";
  const displayEmail = userEmail || "souradeep@cloudagent.dev";
  const initial = (displayName[0] ?? "U").toUpperCase();

  const handleSaveEmail = (e: FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      onUpdateUser(emailInput.trim());
      setEditingEmail(false);
    }
  };

  const handleSignOut = () => {
    onUpdateUser(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative w-full max-w-[520px] rounded-2xl shadow-2xl border transition-colors duration-200 p-6 sm:p-7 ${
          theme === "zinc"
            ? "bg-[#18181b] border-[#27272a] text-[#fafafa]"
            : "bg-white border-slate-200 text-slate-900"
        }`}
        style={{
          fontFamily:
            "'NB International Pro', 'nbInternationalPro', system-ui, -apple-system, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-lg transition-colors cursor-pointer ${
            theme === "zinc"
              ? "text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a]"
              : "text-slate-400 hover:text-slate-800 hover:bg-slate-100"
          }`}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Profile Card Header */}
        <div className="flex items-center gap-4 pb-5 border-b border-slate-200 dark:border-[#27272a]" style={{ borderColor: theme === "zinc" ? "#27272a" : "#f1f5f9" }}>
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shadow-sm shrink-0 ${
              theme === "zinc"
                ? "bg-[#27272a] text-[#fafafa] border border-[#3f3f46]"
                : "bg-slate-100 text-slate-800 border border-slate-200"
            }`}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-semibold tracking-tight truncate m-0">
                {displayName}
              </h2>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  theme === "zinc"
                    ? "bg-[#27272a] text-[#a1a1aa] border border-[#3f3f46]"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                Pro
              </span>
            </div>
            <p
              className={`text-[13px] truncate m-0 mt-0.5 ${
                theme === "zinc" ? "text-[#a1a1aa]" : "text-slate-500"
              }`}
            >
              {displayEmail}
            </p>
          </div>
        </div>

        {/* Section 1: Appearance / Zinc Mode */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5">
            <label
              className={`text-[12px] font-semibold uppercase tracking-wider ${
                theme === "zinc" ? "text-[#a1a1aa]" : "text-slate-500"
              }`}
            >
              Dashboard Theme
            </label>
            <span
              className={`text-[11px] ${
                theme === "zinc" ? "text-[#71717a]" : "text-slate-400"
              }`}
            >
              Applied to workspace dashboard
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Light Mode Card */}
            <button
              type="button"
              onClick={() => onToggleTheme("light")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                theme === "light"
                  ? "border-indigo-600 bg-indigo-50/40 text-slate-900 shadow-xs ring-1 ring-indigo-600"
                  : theme === "zinc"
                  ? "border-[#27272a] bg-[#121215] text-[#a1a1aa] hover:border-[#3f3f46]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex items-center gap-2 text-[13px] font-medium ${
                    theme === "light"
                      ? "text-slate-900 font-semibold"
                      : theme === "zinc"
                      ? "text-[#e4e4e7]"
                      : "text-slate-700"
                  }`}
                >
                  <Sun size={15} className={theme === "light" ? "text-amber-500" : "text-amber-400"} />
                  <span>Light</span>
                </div>
                {theme === "light" && <Check size={14} className="text-indigo-600" />}
              </div>
              <p
                className={`text-[11px] m-0 leading-normal ${
                  theme === "light"
                    ? "text-slate-600"
                    : theme === "zinc"
                    ? "text-[#71717a]"
                    : "text-slate-500"
                }`}
              >
                Studio light palette with crisp contrast.
              </p>
            </button>

            {/* Zinc Mode Card */}
            <button
              type="button"
              onClick={() => onToggleTheme("zinc")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                theme === "zinc"
                  ? "border-indigo-500 bg-[#121215] text-[#fafafa] shadow-xs ring-1 ring-indigo-500/50"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex items-center gap-2 text-[13px] font-medium ${
                    theme === "zinc" ? "text-[#fafafa] font-semibold" : "text-slate-700"
                  }`}
                >
                  <Moon size={15} className="text-indigo-400" />
                  <span>Zinc Dark</span>
                </div>
                {theme === "zinc" && <Check size={14} className="text-indigo-400" />}
              </div>
              <p
                className={`text-[11px] m-0 leading-normal ${
                  theme === "zinc" ? "text-[#a1a1aa]" : "text-slate-500"
                }`}
              >
                Deep neutral zinc charcoal (#09090b).
              </p>
            </button>
          </div>
        </div>

        {/* Section 2: Environment & Quota */}
        <div
          className={`mt-5 p-3.5 rounded-xl border ${
            theme === "zinc"
              ? "bg-[#121215] border-[#27272a]"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-[12px]">
            <span
              className={`flex items-center gap-1.5 font-medium ${
                theme === "zinc" ? "text-[#d4d4d8]" : "text-slate-700"
              }`}
            >
              <Cpu size={14} className="text-emerald-500" /> Daytona Sandbox Engine
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
              Active & Isolated
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
            <span className={theme === "zinc" ? "text-[#a1a1aa]" : "text-slate-500"}>
              Allocated Workspaces
            </span>
            <span
              className={`font-mono font-medium ${
                theme === "zinc" ? "text-[#fafafa]" : "text-slate-800"
              }`}
            >
              {workspaceCount} / 10
            </span>
          </div>
        </div>

        {/* Section 3: Edit email / Sign Out */}
        <div className="mt-6 pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor: theme === "zinc" ? "#27272a" : "#f1f5f9" }}>
          {editingEmail ? (
            <form onSubmit={handleSaveEmail} className="flex items-center gap-2 flex-1">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="developer@example.com"
                className={`flex-1 text-[12px] px-3 py-1.5 rounded-lg border outline-none ${
                  theme === "zinc"
                    ? "bg-[#09090b] border-[#27272a] text-[#fafafa]"
                    : "bg-white border-slate-300 text-slate-900"
                }`}
                autoFocus
              />
              <button
                type="submit"
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingEmail(false)}
                className={`text-[12px] px-2 py-1.5 cursor-pointer ${
                  theme === "zinc" ? "text-[#a1a1aa] hover:text-[#fafafa]" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditingEmail(true)}
                className={`text-[12px] font-medium transition-colors cursor-pointer ${
                  theme === "zinc"
                    ? "text-[#a1a1aa] hover:text-[#fafafa]"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Change email
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`flex items-center gap-1.5 text-[12px] font-medium transition-colors cursor-pointer px-2.5 py-1.5 rounded-lg ${
                    theme === "zinc"
                      ? "text-rose-400 hover:bg-rose-500/10"
                      : "text-rose-600 hover:bg-rose-50"
                  }`}
                >
                  <LogOut size={13} />
                  <span>Sign out</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className={`text-[12.5px] font-semibold px-4 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm ${
                    theme === "zinc"
                      ? "bg-[#fafafa] text-[#09090b] hover:bg-white active:scale-[0.98]"
                      : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]"
                  }`}
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
