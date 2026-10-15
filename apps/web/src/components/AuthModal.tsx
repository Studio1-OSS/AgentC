import { useState, type FormEvent } from "react";
import { X, ArrowRight, Check, Shield } from "lucide-react";
import { AgentLogo } from "./AgentLogo";
import {
  CloudAgentItem,
  CloudAgentsStyles,
  CLOUD_AGENTS,
} from "./CloudAgents";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email?: string) => void;
  initialMode?: "signin" | "signup";
};

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "signin",
}: AuthModalProps) {
  if (!isOpen) return null;

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setTimeout(() => {
        onSuccess(email);
      }, 700);
    }, 600);
  }

  function handleOAuth(provider: "github" | "google") {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess(`${provider}_user@agentc.dev`);
    }, 500);
  }

  function handleGuest() {
    onSuccess("guest@agentc.dev");
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <CloudAgentsStyles />
      <div
        className="relative w-full max-w-[780px] max-h-[92vh] overflow-y-auto bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_25px_70px_-15px_rgba(15,23,42,0.22),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 text-slate-900 animate-in zoom-in-95 duration-200 flex flex-col sm:flex-row my-auto"
        style={{ fontFamily: "var(--font-nb), system-ui, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* 1. Left Landscape Column: Clean White Glass with 4 Agents Back-to-Back */}
        <div className="sm:w-[46%] bg-gradient-to-b from-slate-50/70 via-white/80 to-slate-50/40 p-4 sm:p-7 flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-slate-100/90 relative shrink-0">
          {/* Top Brand & Beta Pill */}
          <div className="flex items-center gap-2.5 mb-6">
            <AgentLogo size={32} />
            <span className="text-[17px] font-bold tracking-tight text-slate-950 flex items-center">
              cloud<span className="font-normal text-slate-700">agent</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100/90 text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
              Beta
            </span>
          </div>

          {/* Center: 4 Cloud Agents in a Clean Horizontal Line Sitting Directly on the Card */}
          <div className="my-auto py-2">
            <div className="flex items-end justify-center gap-1.5 sm:gap-2.5 mb-5 select-none">
              {CLOUD_AGENTS.map((agent) => (
                <CloudAgentItem
                  key={agent.id}
                  id={agent.id}
                  size={50}
                />
              ))}
            </div>

            {/* Clean, short pitch text */}
            <div className="text-center sm:text-left">
              <h3 className="text-[20px] sm:text-[22px] font-semibold tracking-tight text-slate-950 leading-tight mb-1.5">
                Meet AgentC.
              </h3>
              <p className="text-[13px] text-slate-600 leading-relaxed font-normal">
                Writes code, runs tests, and ships pull requests in isolated Daytona sandboxes. Yours is next.
              </p>
            </div>
          </div>

          {/* Clean spacer */}
          <div className="hidden sm:block h-2" />
        </div>

        {/* 2. Right Landscape Column: Auth Form */}
        <div className="sm:w-[54%] p-6 sm:p-7 flex flex-col justify-between relative bg-white/80 backdrop-blur-xl">
          <div>
            {/* Header */}
            <div className="mb-6 pr-8">
              <h2 className="text-[23px] sm:text-[25px] font-semibold tracking-tight text-slate-950 mb-1">
                {mode === "signin" ? "Sign in to AgentC" : "Create your account"}
              </h2>
              <p className="text-[13.5px] text-slate-500 leading-normal">
                {mode === "signin"
                  ? "Welcome back. Continue with your preferred sign-in provider."
                  : "Launch isolated Daytona sandboxes and collaborate with AI."}
              </p>
            </div>

            {/* OAuth Buttons */}
            <div className="flex flex-col gap-2.5 mb-5">
              <button
                type="button"
                onClick={() => handleOAuth("github")}
                disabled={loading}
                className="w-full h-11 px-4 flex items-center justify-center gap-3 rounded-full border border-slate-200/90 bg-white/90 hover:bg-white text-[14px] font-medium text-slate-800 transition-all shadow-xs hover:border-slate-300 hover:shadow-sm disabled:opacity-50 cursor-pointer backdrop-blur-sm"
              >
                <svg
                  className="w-5 h-5 text-slate-900"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                Continue with GitHub
              </button>

              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={loading}
                className="w-full h-11 px-4 flex items-center justify-center gap-3 rounded-full border border-slate-200/90 bg-white/90 hover:bg-white text-[14px] font-medium text-slate-800 transition-all shadow-xs hover:border-slate-300 hover:shadow-sm disabled:opacity-50 cursor-pointer backdrop-blur-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                Continue with Google
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-5">
              <div className="border-t border-slate-200/90 w-full" />
              <span className="bg-white/90 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider backdrop-blur-sm whitespace-nowrap">
                or work email
              </span>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="auth-email" className="sr-only">
                  Work email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-11 px-4 text-[14px] rounded-full border border-slate-200/90 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent transition-all shadow-xs"
                />
              </div>

              {/* Primary Button - Obsidian Dark Glass */}
              <button
                type="submit"
                disabled={loading || submitted}
                className="obsidian-glass-button w-full h-11 px-5 flex items-center justify-center gap-2 rounded-full text-white text-[14px] font-medium transition-all cursor-pointer relative overflow-hidden group hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 via-white/10 to-transparent pointer-events-none rounded-t-full" />
                {submitted ? (
                  <>
                    <Check size={16} /> Authenticated!
                  </>
                ) : loading ? (
                  "Connecting..."
                ) : (
                  <>
                    <span className="relative z-10">Continue with Email</span>
                    <ArrowRight size={15} className="relative z-10 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Instant Sandbox Access */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={handleGuest}
                className="inline-flex items-center text-[13px] font-medium text-slate-700 hover:text-slate-950 hover:underline transition-colors cursor-pointer"
              >
                Launch Instant Sandbox (Guest Mode)
              </button>
            </div>
          </div>

          {/* Toggle signin/signup & security */}
          <div className="mt-5 pt-3 border-t border-slate-100/90">
            <div className="text-center text-[13px] text-slate-500 mb-2">
              {mode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-semibold text-slate-900 hover:underline cursor-pointer"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-semibold text-slate-900 hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Shield size={12} />
              <span>Encrypted with zero-trust Daytona sandbox isolation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
