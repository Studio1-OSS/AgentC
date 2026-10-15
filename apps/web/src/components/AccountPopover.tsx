import { useState, useRef, useEffect, type FormEvent } from "react";
import { Sun, Moon, X, Mail, LogOut } from "lucide-react";

export type AccountPopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string | null;
  onUpdateUser: (email: string | null) => void;
  theme: "light" | "zinc";
  onToggleTheme: (theme: "light" | "zinc") => void;
  workspaceCount: number;
};

export function AccountPopover({
  isOpen,
  onClose,
  userEmail,
  onUpdateUser,
  theme,
  onToggleTheme,
  workspaceCount,
}: AccountPopoverProps) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(userEmail ?? "");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEmailInput(userEmail ?? "");
  }, [userEmail]);

  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest(".devin-user-team-btn")) return;
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = userEmail ? userEmail.split("@")[0] : "Souradeep";
  const displayEmail = userEmail || "souradeep@cloudagent.dev";
  const initial = (displayName[0] ?? "S").toUpperCase();
  const isZinc = theme === "zinc";

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
      ref={popoverRef}
      className="account-popover-menu"
      role="dialog"
      aria-modal="false"
      aria-label="User Account and Preferences"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Profile Header */}
      <div className="popover-header">
        <div className="popover-avatar">
          {initial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="popover-name-row">
            <span className="popover-name">
              {displayName}
            </span>
            <span className="popover-pro-badge">
              Pro
            </span>
          </div>
          <p className="popover-email">
            {displayEmail}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="popover-close-btn"
          aria-label="Close menu"
        >
          <X size={13} />
        </button>
      </div>

      {/* 2. Theme Selector - Clean 2-segment control */}
      <div>
        <div className="popover-section-label">
          Theme
        </div>
        <div className="popover-theme-toggle">
          <button
            type="button"
            onClick={() => onToggleTheme("light")}
            className={`popover-theme-btn ${!isZinc ? "active" : ""}`}
          >
            <Sun size={13} strokeWidth={2} />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleTheme("zinc")}
            className={`popover-theme-btn ${isZinc ? "active" : ""}`}
          >
            <Moon size={13} strokeWidth={2} />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* 3. Daytona Engine Workspace Tracker */}
      <div className="popover-engine-card">
        <div className="popover-engine-title-row">
          <span className="popover-engine-title">Daytona Sandboxes</span>
          <span className="popover-engine-quota-val">
            {workspaceCount} / 10
          </span>
        </div>
        <div className="popover-engine-progress-track">
          <div
            className="popover-engine-progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, (workspaceCount / 10) * 100))}%` }}
          />
        </div>
        <div className="popover-engine-quota-row">
          <span>Active sandboxes</span>
          <span>{Math.max(0, 10 - workspaceCount)} available</span>
        </div>
      </div>

      <div className="popover-divider" />

      {/* 4. Actions: Change email & Sign Out */}
      {editingEmail ? (
        <form onSubmit={handleSaveEmail} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="developer@example.com"
            style={{
              width: "100%",
              fontSize: "11.5px",
              padding: "6px 8px",
              borderRadius: 6,
              border: isZinc ? "1px solid #27272a" : "1px solid #cbd5e1",
              background: isZinc ? "#09090b" : "#ffffff",
              color: isZinc ? "#fafafa" : "#0f172a",
              outline: "none",
            }}
            autoFocus
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
            <button
              type="button"
              onClick={() => setEditingEmail(false)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "11px",
                color: isZinc ? "#a1a1aa" : "#64748b",
                cursor: "pointer",
                padding: "2px 6px",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                border: "none",
                fontSize: "11px",
                fontWeight: 600,
                borderRadius: 5,
                padding: "4px 10px",
                background: isZinc ? "#fafafa" : "#0f172a",
                color: isZinc ? "#09090b" : "#ffffff",
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button
            type="button"
            onClick={() => setEditingEmail(true)}
            className="popover-action-btn"
          >
            <Mail size={13} strokeWidth={2} />
            <span>Change email</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="popover-signout-btn"
          >
            <LogOut size={13} strokeWidth={2} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
