import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, CircleAlert, ListFilter, MoreHorizontal, Pin, PinOff, Sparkles, Trash2, X } from "lucide-react";

/* Slide-over inbox for things that happened while you were elsewhere:
 * workspaces finishing setup or failing, and agent runs completing. */

export type NotificationKind = "workspace-ready" | "workspace-error" | "agent-done";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  at: number;
  read: boolean;
  workspaceId?: string;
};

type Filter = "all" | "workspaces" | "agent";

type NotificationsPanelProps = {
  open: boolean;
  pinned: boolean;
  items: AppNotification[];
  onClose: () => void;
  onTogglePin: () => void;
  onOpenItem: (item: AppNotification) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
};

function timeAgo(at: number, now: number) {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(at).toLocaleDateString([], { month: "short", day: "numeric" });
}

const ICONS: Record<NotificationKind, typeof Bell> = {
  "workspace-ready": Check,
  "workspace-error": CircleAlert,
  "agent-done": Sparkles,
};

export function NotificationsPanel({
  open,
  pinned,
  items,
  onClose,
  onTogglePin,
  onOpenItem,
  onMarkAllRead,
  onClear,
}: NotificationsPanelProps) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [menu, setMenu] = useState<"more" | "filter" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const panelRef = useRef<HTMLElement>(null);
  const [dockLeft, setDockLeft] = useState(0);

  // Dock flush against the sidebar's right edge, tracking collapse/resize.
  useEffect(() => {
    if (!open) return;
    const sidebar = document.querySelector<HTMLElement>(".devin-sidebar");
    const measure = () => {
      const rect = sidebar?.getBoundingClientRect();
      setDockLeft(rect && rect.width > 0 && rect.right > 0 ? Math.round(rect.right) : 0);
    };
    measure();
    const observer = sidebar ? new ResizeObserver(measure) : null;
    if (sidebar) observer?.observe(sidebar);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  // Refresh relative times while open.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  // Escape closes the open menu first, then the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menu) setMenu(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, menu, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
    else setMenu(null);
  }, [open]);

  if (!open) return null;

  const unread = items.filter((n) => !n.read).length;
  const visible = items
    .filter((n) => (tab === "unread" ? !n.read : true))
    .filter((n) =>
      filter === "all" ? true : filter === "agent" ? n.kind === "agent-done" : n.kind !== "agent-done",
    );

  return (
    <>
      {!pinned && <div className="notif-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside
        ref={panelRef}
        className={`notif-panel ${pinned ? "is-pinned" : ""}`}
        role="dialog"
        aria-label="Notifications"
        tabIndex={-1}
        style={{ left: dockLeft }}
      >
        <header className="notif-head">
          <h2 className="notif-title">Notifications</h2>
          <div className="notif-head-actions">
            <div className="notif-menu-wrap">
              <button
                type="button"
                className={`notif-icon-btn ${menu === "more" ? "active" : ""}`}
                onClick={() => setMenu((m) => (m === "more" ? null : "more"))}
                title="More"
                aria-label="More actions"
                aria-expanded={menu === "more"}
              >
                <MoreHorizontal size={16} />
              </button>
              {menu === "more" && (
                <div className="notif-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!unread}
                    onClick={() => {
                      onMarkAllRead();
                      setMenu(null);
                    }}
                  >
                    <CheckCheck size={14} /> Mark all as read
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!items.length}
                    onClick={() => {
                      onClear();
                      setMenu(null);
                    }}
                  >
                    <Trash2 size={14} /> Clear all
                  </button>
                </div>
              )}
            </div>
            <div className="notif-menu-wrap">
              <button
                type="button"
                className={`notif-icon-btn ${menu === "filter" || filter !== "all" ? "active" : ""}`}
                onClick={() => setMenu((m) => (m === "filter" ? null : "filter"))}
                title="Filter"
                aria-label="Filter notifications"
                aria-expanded={menu === "filter"}
              >
                <ListFilter size={16} />
              </button>
              {menu === "filter" && (
                <div className="notif-menu" role="menu">
                  {(
                    [
                      ["all", "Everything"],
                      ["workspaces", "Workspaces"],
                      ["agent", "Agent runs"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={filter === value}
                      onClick={() => {
                        setFilter(value);
                        setMenu(null);
                      }}
                    >
                      <span className="notif-menu-check">{filter === value && <Check size={13} />}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className={`notif-icon-btn ${pinned ? "active" : ""}`}
              onClick={onTogglePin}
              title={pinned ? "Unpin" : "Pin open"}
              aria-label={pinned ? "Unpin panel" : "Pin panel open"}
              aria-pressed={pinned}
            >
              {pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
            <button type="button" className="notif-icon-btn" onClick={onClose} title="Close" aria-label="Close notifications">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="notif-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={`notif-tab ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "unread"}
            className={`notif-tab ${tab === "unread" ? "active" : ""}`}
            onClick={() => setTab("unread")}
          >
            Unread <span className="notif-tab-count">{unread}</span>
          </button>
        </div>

        <div className="notif-body">
          {visible.length ? (
            <ul className="notif-list">
              {visible.map((n) => {
                const Icon = ICONS[n.kind];
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`notif-item ${n.read ? "" : "unread"} kind-${n.kind}`}
                      onClick={() => onOpenItem(n)}
                    >
                      <span className="notif-item-icon">
                        <Icon size={14} />
                      </span>
                      <span className="notif-item-text">
                        <span className="notif-item-title">{n.title}</span>
                        {n.body && <span className="notif-item-body">{n.body}</span>}
                      </span>
                      <span className="notif-item-meta">
                        <span className="notif-item-time">{timeAgo(n.at, now)}</span>
                        {!n.read && <span className="notif-unread-dot" aria-label="Unread" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="notif-empty">
              <span className="notif-empty-icon">
                <Bell size={18} />
              </span>
              <p className="notif-empty-title">You&apos;re all caught up</p>
              <p className="notif-empty-text">New notifications will show up here.</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
