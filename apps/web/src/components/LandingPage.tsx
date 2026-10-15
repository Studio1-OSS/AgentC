import { useState, useEffect, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Check,
  X,
  Box,
  Terminal,
  Globe,
  Workflow,
} from "lucide-react";
import { AgentLogo } from "./AgentLogo";
import { JellyCharacters } from "./JellyCharacters";
import type { Workspace } from "@/lib/workspaces";

type LandingPageProps = {
  workspaces?: Workspace[];
  onConnectWorkspace?: (workspace: Workspace) => void;
  onCreateWorkspace?: (e: FormEvent) => void;
  onGetStarted: () => void;
  onLogin: () => void;
  onLaunchDemo?: () => void;
  repo?: string;
  setRepo?: (repo: string) => void;
  branch?: string;
  setBranch?: (branch: string) => void;
  empty?: boolean;
  setEmpty?: (empty: boolean) => void;
  pending?: boolean;
  error?: string | null;
  userEmail?: string | null;
};

export function LandingPage({
  onGetStarted,
  onLogin,
  userEmail = null,
}: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"product" | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [earlyAccessModalOpen, setEarlyAccessModalOpen] = useState(false);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [customersModalOpen, setCustomersModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [blogModalOpen, setBlogModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [earlyAccessSubmitted, setEarlyAccessSubmitted] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoCompany, setDemoCompany] = useState("");
  const [earlyEmail, setEarlyEmail] = useState("");
  const [earlyGithub, setEarlyGithub] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDropdown(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDemoSubmit = (e: FormEvent) => {
    e.preventDefault();
    setDemoSubmitted(true);
    setTimeout(() => {
      setDemoSubmitted(false);
      setDemoModalOpen(false);
      setDemoEmail("");
      setDemoCompany("");
    }, 2000);
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col justify-between text-[#111827] selection:bg-slate-200 selection:text-slate-900 relative bg-white overflow-x-hidden"
      style={{
        fontFamily:
          "'NB International Pro', 'nbInternationalPro', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 1. Global Navigation Bar - Devin.ai Style Architecture with Mega Dropdowns */}
      <nav
        className="w-full shrink-0 relative bg-white/95 backdrop-blur-md z-30 pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
        onMouseLeave={() => setActiveDropdown(null)}
      >
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-15 sm:h-16 flex items-center justify-between gap-2">
          {/* Brand Left */}
          <div className="flex items-center gap-3 sm:gap-7 lg:gap-9 shrink-0 min-w-0">
            <button
              onClick={() => {
                setActiveDropdown(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center gap-2 sm:gap-2.5 text-left text-slate-900 cursor-pointer shrink-0 select-none"
              aria-label="AgentC Home"
            >
              <span className="sm:hidden flex items-center shrink-0">
                <AgentLogo size={32} />
              </span>
              <span className="hidden sm:flex items-center shrink-0">
                <AgentLogo size={38} />
              </span>
              <span className="text-[17px] sm:text-[19px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[9.5px] sm:text-[10px] font-semibold tracking-wide px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100/80 backdrop-blur-md text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Beta
              </span>
            </button>

            {/* Desktop Nav Items: Product, Pricing, Blog */}
            <div className="hidden md:flex items-center gap-1 text-[14px]">
              {/* Product Mega Menu Trigger */}
              <button
                onClick={() =>
                  setActiveDropdown(
                    activeDropdown === "product" ? null : "product"
                  )
                }
                onMouseEnter={() => setActiveDropdown("product")}
                className={`px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeDropdown === "product"
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-50"
                }`}
              >
                <span>Product</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 text-slate-500 ${
                    activeDropdown === "product"
                      ? "rotate-180 text-slate-900"
                      : ""
                  }`}
                />
              </button>

              {/* Pricing */}
              <button
                onClick={() => {
                  setActiveDropdown(null);
                  setPricingModalOpen(true);
                }}
                onMouseEnter={() => setActiveDropdown(null)}
                className="px-3 py-1.5 rounded-full font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Pricing
              </button>

              {/* Blog */}
              <button
                onClick={() => {
                  setActiveDropdown(null);
                  setBlogModalOpen(true);
                }}
                onMouseEnter={() => setActiveDropdown(null)}
                className="px-3 py-1.5 rounded-full font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Blog
              </button>
            </div>
          </div>

          {/* Action Buttons Right: Get a demo, Login, Get started */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setActiveDropdown(null);
                setDemoModalOpen(true);
              }}
              className="text-[14px] font-medium text-slate-700 hover:text-slate-950 transition-colors cursor-pointer px-2 py-1"
            >
              Get a demo
            </button>
            <button
              onClick={() => {
                setActiveDropdown(null);
                onLogin();
              }}
              className="h-8.5 px-3.5 rounded-full border border-slate-200/90 bg-white text-[13.5px] font-normal text-slate-800 hover:text-slate-950 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {userEmail ? "Dashboard" : "Login"}
            </button>
            <button
              onClick={() => {
                setActiveDropdown(null);
                onGetStarted();
              }}
              className="obsidian-glass-button h-8.5 px-4.5 rounded-full text-[13.5px] font-medium transition-all cursor-pointer flex items-center justify-center shadow-xs shrink-0 whitespace-nowrap"
            >
              <span className="relative z-10 whitespace-nowrap">Get started</span>
            </button>
          </div>

          {/* Mobile Action & Menu Trigger - Sleek Get Started + 3-Dots Button */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveDropdown(null);
                onGetStarted();
              }}
              className="obsidian-glass-button h-8 px-3 rounded-full text-white text-[12px] font-medium transition-all cursor-pointer shadow-xs shrink-0 whitespace-nowrap flex items-center justify-center"
            >
              <span className="relative z-10 whitespace-nowrap">Get started</span>
            </button>

            {/* Mobile Menu Trigger Button - 3 dots only, NO TEXT */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="w-8 h-8 rounded-full border border-slate-200/90 bg-white/95 text-slate-800 hover:text-slate-950 hover:bg-slate-50 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center justify-center shrink-0 select-none"
              aria-label="Open navigation menu"
            >
              <div className="flex items-center gap-[3px] text-slate-800 pointer-events-none">
                <span className="w-1 h-1 rounded-full bg-slate-900" />
                <span className="w-1 h-1 rounded-full bg-slate-900" />
                <span className="w-1 h-1 rounded-full bg-slate-900" />
              </div>
            </button>
          </div>
        </div>

        {/* 1A. MEGA-DROPDOWN: Product (Exact Devin.ai layout) */}
        {activeDropdown === "product" && (
          <div
            className="absolute left-0 right-0 top-16 bg-white border-b border-slate-200/90 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150 z-40"
            onMouseEnter={() => setActiveDropdown("product")}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-[14px]">
                {/* Column 1: Surfaces */}
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Surfaces
                  </h4>
                  <ul className="space-y-3">
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          onGetStarted();
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left"
                      >
                        <span>AgentC Web</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setAboutModalOpen(true);
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left"
                      >
                        <span>AgentC Desktop</span>
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-semibold border border-slate-200">
                          Beta
                        </span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setDocsModalOpen(true);
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1 cursor-pointer text-left group"
                      >
                        <span>AgentC CLI</span>
                        <ArrowUpRight
                          size={13}
                          className="text-slate-400 group-hover:text-slate-900 transition-colors"
                        />
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setEarlyAccessModalOpen(true);
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1 cursor-pointer text-left group"
                      >
                        <span>@agentc Bot</span>
                        <ArrowUpRight
                          size={13}
                          className="text-slate-400 group-hover:text-slate-900 transition-colors"
                        />
                      </button>
                    </li>
                  </ul>
                </div>

                {/* Column 2: Features */}
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Features
                  </h4>
                  <ul className="space-y-3">
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setDocsModalOpen(true);
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1 cursor-pointer text-left group"
                      >
                        <span>DeepCode Review</span>
                        <ArrowUpRight
                          size={13}
                          className="text-slate-400 group-hover:text-slate-900 transition-colors"
                        />
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setAboutModalOpen(true);
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1 cursor-pointer text-left group"
                      >
                        <span>Test Suite Healer</span>
                        <ArrowUpRight
                          size={13}
                          className="text-slate-400 group-hover:text-slate-900 transition-colors"
                        />
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setActiveAgent("spiky");
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left"
                      >
                        <span>Security Swarm</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setActiveAgent("clover");
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left"
                      >
                        <span>Browser Agent</span>
                      </button>
                    </li>
                  </ul>
                </div>

                {/* Column 3: Platform */}
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Platform
                  </h4>
                  <ul className="space-y-3">
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setDocsModalOpen(true);
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1 cursor-pointer text-left group"
                      >
                        <span>Daytona Sandboxes</span>
                        <ArrowUpRight
                          size={13}
                          className="text-slate-400 group-hover:text-slate-900 transition-colors"
                        />
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setAboutModalOpen(true);
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1 cursor-pointer text-left group"
                      >
                        <span>Autonomous CI/CD</span>
                        <ArrowUpRight
                          size={13}
                          className="text-slate-400 group-hover:text-slate-900 transition-colors"
                        />
                      </button>
                    </li>
                    <li>
                      <span className="font-medium text-slate-800 flex items-center gap-1.5">
                        <span>Zero-Trust Network</span>
                      </span>
                    </li>
                    <li>
                      <span className="font-medium text-slate-800 flex items-center gap-1.5">
                        <span>Dedicated NVMe Volumes</span>
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Column 4: Models */}
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Models
                  </h4>
                  <ul className="space-y-3">
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setDocsModalOpen(true);
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1 cursor-pointer text-left group"
                      >
                        <span>SWE-Bench Verified</span>
                        <ArrowUpRight
                          size={13}
                          className="text-slate-400 group-hover:text-slate-900 transition-colors"
                        />
                      </button>
                    </li>
                    <li>
                      <span className="font-medium text-slate-800 flex items-center gap-1.5">
                        <span>Pi Multi-Turn Core</span>
                      </span>
                    </li>
                    <li>
                      <span className="font-medium text-slate-800 flex items-center gap-1.5">
                        <span>Fusion Reasoning</span>
                      </span>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setDocsModalOpen(true);
                        }}
                        className="font-medium text-slate-800 hover:text-slate-950 hover:translate-x-0.5 transition-all flex items-center gap-1 cursor-pointer text-left group"
                      >
                        <span>Public Evals</span>
                        <ArrowUpRight
                          size={13}
                          className="text-slate-400 group-hover:text-slate-900 transition-colors"
                        />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Bottom quote banner */}
              <div className="pt-5 border-t border-slate-100 flex items-center justify-between text-[13px] text-slate-500">
                <p>
                  AgentC runs in isolated Daytona sandboxes, tests in its own
                  environment, and works until the PR is ready to merge.
                </p>
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    setAboutModalOpen(true);
                  }}
                  className="font-medium text-slate-800 hover:text-slate-950 hover:underline cursor-pointer shrink-0 ml-4"
                >
                  Learn how it works →
                </button>
              </div>
            </div>
          </div>
        )}

      </nav>

      {/* 2. Hero Center Section - Flawlessly Centered Across All Devices & Viewports */}
      <main className="flex-1 w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto my-auto py-6 sm:py-8">
        {/* 4 Cloud Jelly Agents */}
        <div className="mb-4 sm:mb-5 flex justify-center w-full transform hover:scale-[1.01] transition-transform">
          <JellyCharacters
            activeId={activeAgent}
            onSelect={(id) => setActiveAgent(id)}
          />
        </div>

        {/* Short, elegant display headline - Strictly 2 lines, compact and balanced */}
        <h1
          className="text-[24px] min-[360px]:text-[28px] sm:text-[38px] md:text-[46px] lg:text-[52px] xl:text-[56px] leading-[1.12] font-normal tracking-[-0.035em] text-[#0f172a] max-w-[920px] mx-auto text-center mb-3.5 sm:mb-4 md:mb-5"
          style={{
            fontFamily:
              "'NB International Pro', 'nbInternationalPro', system-ui, sans-serif",
          }}
        >
          <span className="block sm:whitespace-nowrap">Meet AgentC.</span>
          <span className="block sm:whitespace-nowrap">Your autonomous agent.</span>
        </h1>

        {/* Short, punchy subtitle based on AgentC - exactly like Image 1 */}
        <p
          className="text-[15px] sm:text-[17px] md:text-[18px] leading-[1.45] text-slate-600 max-w-[560px] mx-auto text-center mb-6 sm:mb-7 md:mb-8 font-normal"
          style={{
            fontFamily:
              "'NB International Pro', 'nbInternationalPro', system-ui, sans-serif",
          }}
        >
          Writes code, runs tests, and ships pull requests{" "}
          <br className="hidden sm:inline" />
          in isolated Daytona sandboxes. Yours is next.
        </p>

        {/* Action Pills Row */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mx-auto">
          {/* Glassy Lime Pill Button */}
          <button
            onClick={() => setDemoModalOpen(true)}
            className="h-[46px] px-6 rounded-full text-[#0f172a] text-[15px] font-semibold transition-all flex items-center gap-2 group cursor-pointer relative overflow-hidden backdrop-blur-md border border-white/60 hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(206, 248, 85, 0.96) 0%, rgba(181, 239, 53, 0.9) 100%)",
              boxShadow:
                "inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.08), 0 4px 18px -2px rgba(181, 239, 53, 0.45), 0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            {/* Glass reflection top highlight */}
            <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-t-full" />
            <span className="relative z-10">Book a demo</span>
            <ArrowRight
              size={16}
              className="relative z-10 group-hover:translate-x-0.5 transition-transform"
            />
          </button>

          {/* Obsidian Glass Pill Button: Early access */}
          <button
            type="button"
            onClick={() => setEarlyAccessModalOpen(true)}
            className="h-[46px] px-6 rounded-full text-white text-[15px] font-medium transition-all flex items-center gap-2 group cursor-pointer relative overflow-hidden backdrop-blur-xl border border-white/20 hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.96) 55%, rgba(2, 6, 23, 0.98) 100%)",
              boxShadow:
                "inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.35), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.6), 0 8px 24px -4px rgba(15, 23, 42, 0.4), 0 2px 6px rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* Glossy curved reflection highlight */}
            <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 via-white/10 to-transparent pointer-events-none rounded-t-full" />
            <span className="relative z-10 font-medium tracking-tight">Early access</span>
            <ArrowRight
              size={15}
              className="relative z-10 text-white/80 group-hover:text-white group-hover:translate-x-0.5 transition-transform"
            />
          </button>
        </div>
      </main>

      {/* 3. Bottom Status Bar & Studio1 Footer - Clean, Responsive Single Row */}
      <footer className="w-full shrink-0 border-t border-slate-100 bg-white py-4 px-4 sm:px-6 lg:px-8 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] text-[13px] text-slate-600 z-10">
        <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-3 text-left">
          {/* Left: Copyright & Privacy Policy */}
          <div className="text-[12px] sm:text-[13px] text-slate-500 font-normal shrink-0 flex items-center gap-1.5 sm:gap-2">
            <span>© 2026 AgentC Inc.</span>
            <span className="hidden sm:inline">All rights reserved.</span>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => setPrivacyModalOpen(true)}
              className="text-slate-500 hover:text-slate-900 hover:underline cursor-pointer transition-colors"
            >
              Privacy Policy
            </button>
          </div>

          {/* Right: Studio1 Credit SVG - 'by Studio1' on phone, 'by Studio1 · Working worldwide' on big screen */}
          <div className="flex items-center gap-1.5 text-slate-700 font-medium shrink-0 text-[12px] sm:text-[13px]">
            <span className="text-slate-500 font-normal">by</span>
            <svg
              viewBox="0 0 160 160"
              width="16"
              height="16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="inline-block shrink-0 align-middle w-4 h-4 min-w-[16px] min-h-[16px]"
              aria-label="Studio1"
            >
              <defs>
                <linearGradient
                  id="paint0_linear_25_11"
                  x1="0"
                  y1="0"
                  x2="160"
                  y2="160"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="60%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
              </defs>
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M0 35C0 16.6807 14.0744 1.64844 32 0.126953V141H51.0523C52.4308 137.344 54.7446 133.689 57.9938 130.033C61.1446 126.508 64.6892 123.44 68.6277 120.829C72.5662 118.349 76.3569 116.782 80 116.129V86.7544C75.4708 87.9292 71.3846 89.6919 67.7415 92.0415C64 94.5225 60.7508 97.46 57.9938 100.854C56.5345 102.72 55.2545 104.659 54.1539 106.671V0H125C144.33 0 160 15.6699 160 35V125C160 144.33 144.33 160 125 160H124V18H104.948C103.569 21.6816 101.255 25.3628 98.0062 29.0444C94.8554 32.5942 91.3108 35.6841 87.3723 38.314C83.4338 40.812 79.6431 42.3896 76 43.0474V72.6304C80.5292 71.4473 84.6154 69.6724 88.2585 67.3057C92 64.8076 95.2492 61.8491 98.0062 58.4307C99.4655 56.5513 100.745 54.5986 101.846 52.5723V160H35C15.67 160 0 144.33 0 125V35Z"
                fill="url(#paint0_linear_25_11)"
              />
            </svg>
            <span className="font-semibold text-slate-900 tracking-tight">
              Studio1
            </span>
            <span className="hidden sm:inline text-slate-400 font-normal">· Working worldwide</span>
          </div>
        </div>
      </footer>

      {/* 4. "Get a demo" Modal */}
      {demoModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDemoModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-2xl rounded-3xl p-7 sm:p-8 max-w-[460px] w-full shadow-[0_25px_70px_-15px_rgba(15,23,42,0.28),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 relative max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDemoModalOpen(false)}
              className="absolute top-5 right-5 z-20 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-3.5">
              <AgentLogo size={32} />
              <span className="text-[17px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100/80 backdrop-blur-md text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Beta
              </span>
            </div>

            <h3 className="text-[22px] font-bold tracking-tight text-slate-950 mb-1.5">
              Book a AgentC Demo
            </h3>
            <p className="text-[14px] text-slate-600 leading-relaxed mb-6">
              Experience autonomous PR workflows, live Daytona sandboxes, and SWE reasoning tailored to your team.
            </p>

            {demoSubmitted ? (
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-[14px] flex items-center gap-2 backdrop-blur-sm">
                <Check size={18} className="text-emerald-600 shrink-0" />
                <span>Demo request received! Our engineering team will reach out shortly.</span>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Work email
                  </label>
                  <input
                    type="email"
                    required
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full h-11 px-3.5 text-[14px] rounded-xl border border-slate-200/90 bg-slate-50/70 backdrop-blur-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950/10 focus:border-slate-400 focus:bg-white transition-all shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Company or Organization
                  </label>
                  <input
                    type="text"
                    required
                    value={demoCompany}
                    onChange={(e) => setDemoCompany(e.target.value)}
                    placeholder="Acme Inc."
                    className="w-full h-11 px-3.5 text-[14px] rounded-xl border border-slate-200/90 bg-slate-50/70 backdrop-blur-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950/10 focus:border-slate-400 focus:bg-white transition-all shadow-xs"
                  />
                </div>

                <div className="pt-2 flex flex-col items-center gap-2.5">
                  <button
                    type="submit"
                    className="obsidian-glass-button w-full h-11 rounded-xl text-white text-[14px] font-medium transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-sm"
                  >
                    <span className="relative z-10">Schedule Demo</span>
                    <ArrowRight size={15} className="relative z-10 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDemoModalOpen(false);
                      onGetStarted();
                    }}
                    className="text-center text-[13px] text-slate-500 hover:text-slate-900 font-medium cursor-pointer transition-colors pt-0.5"
                  >
                    Or launch instant sandbox right now →
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 5. "About" Modal */}
      {aboutModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setAboutModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-[0_25px_70px_-15px_rgba(15,23,42,0.28),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 relative max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAboutModalOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <AgentLogo size={32} />
              <span className="text-[17px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100/80 backdrop-blur-md text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Beta
              </span>
            </div>
            <h3 className="text-[21px] font-bold text-slate-950 mb-1">
              About AgentC
            </h3>
            <p className="text-[14px] text-slate-600 leading-relaxed mb-6">
              AgentC pairs frontier LLM reasoning with real Linux sandboxes.
              Instead of mocking responses, agents operate directly inside isolated
              Daytona containers with full tool autonomy.
            </p>

            <div className="space-y-3 mb-6 text-[13.5px]">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <Box size={18} className="text-slate-800 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900">
                    Isolated Daytona Sandboxes
                  </h4>
                  <p className="text-slate-600 text-[13px] mt-0.5">
                    Dedicated NVMe volume, root terminal access, and zero-trust
                    networking for every session.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <Terminal size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900">
                    Full-Stack Build & Test Healer
                  </h4>
                  <p className="text-slate-600 text-[13px] mt-0.5">
                    Compiles TypeScript, runs Jest / Vitest suites, and fixes lint
                    regressions automatically.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <Globe size={18} className="text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900">
                    Headless Browser Verification
                  </h4>
                  <p className="text-slate-600 text-[13px] mt-0.5">
                    Inspects live DOM elements and validates visual UI layouts
                    in headless Chrome.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <Workflow size={18} className="text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900">
                    Autonomous GitHub PRs
                  </h4>
                  <p className="text-slate-600 text-[13px] mt-0.5">
                    Commits clean code, generates architectural change summaries,
                    and opens pull requests.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  setAboutModalOpen(false);
                  setEarlyAccessModalOpen(true);
                }}
                className="obsidian-glass-button flex-1 h-11 rounded-full text-white text-[14px] font-medium transition-all flex items-center justify-center gap-1.5 group cursor-pointer"
              >
                <span className="relative z-10 font-medium">Request Early Access</span>
                <ArrowRight size={14} className="relative z-10 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => {
                  setAboutModalOpen(false);
                  setDemoModalOpen(true);
                }}
                className="px-5 h-11 rounded-full border border-slate-200/90 bg-white/80 hover:bg-white text-slate-800 text-[14px] font-medium transition-all cursor-pointer backdrop-blur-sm shadow-xs"
              >
                Book a demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. "Early Access" Modal - Distinct from Demo */}
      {earlyAccessModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setEarlyAccessModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-2xl rounded-3xl p-7 sm:p-8 max-w-[460px] w-full shadow-[0_25px_70px_-15px_rgba(15,23,42,0.28),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 relative max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEarlyAccessModalOpen(false)}
              className="absolute top-5 right-5 z-20 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-3.5">
              <AgentLogo size={32} />
              <span className="text-[17px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100/80 backdrop-blur-md text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Beta
              </span>
            </div>

            <h3 className="text-[22px] font-bold tracking-tight text-slate-950 mb-1.5">
              Request Early Access
            </h3>
            <p className="text-[14px] text-slate-600 leading-relaxed mb-6">
              Join the private developer waitlist for alpha access to AgentC
              and isolated Daytona sandbox environments.
            </p>

            {earlyAccessSubmitted ? (
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-[14px] flex items-center gap-2 backdrop-blur-sm">
                <Check size={18} className="text-emerald-600 shrink-0" />
                <span>You're on the waitlist! We are provisioning early developer sandboxes weekly.</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setEarlyAccessSubmitted(true);
                  setTimeout(() => {
                    setEarlyAccessSubmitted(false);
                    setEarlyAccessModalOpen(false);
                  }, 2200);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    value={earlyEmail}
                    onChange={(e) => setEarlyEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full h-11 px-3.5 text-[14px] rounded-xl border border-slate-200/90 bg-slate-50/70 backdrop-blur-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950/10 focus:border-slate-400 focus:bg-white transition-all shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    GitHub Username
                  </label>
                  <input
                    type="text"
                    required
                    value={earlyGithub}
                    onChange={(e) => setEarlyGithub(e.target.value)}
                    placeholder="octocat"
                    className="w-full h-11 px-3.5 text-[14px] rounded-xl border border-slate-200/90 bg-slate-50/70 backdrop-blur-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950/10 focus:border-slate-400 focus:bg-white transition-all shadow-xs"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="obsidian-glass-button w-full h-11 px-5 flex items-center justify-center gap-2 rounded-xl text-white text-[14px] font-medium transition-all cursor-pointer group shadow-sm"
                  >
                    <span className="relative z-10 font-medium">Join Early Access Waitlist</span>
                    <ArrowRight size={15} className="relative z-10 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 7. "Docs" Modal */}
      {docsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDocsModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-[0_25px_70px_-15px_rgba(15,23,42,0.28),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 relative max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDocsModalOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <AgentLogo size={32} />
              <span className="text-[17px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100/80 backdrop-blur-md text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Beta
              </span>
            </div>
            <h3 className="text-[21px] font-bold text-slate-950 mb-1">
              AgentC Documentation
            </h3>
            <p className="text-[14px] text-slate-600 leading-relaxed mb-6">
              Learn how AgentC runs autonomous engineering loops inside Daytona sandboxes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6 text-[13.5px]">
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <h4 className="font-semibold text-slate-900 mb-1">Architecture & Runtime</h4>
                <p className="text-slate-600 text-[13px]">
                  Each task runs inside an isolated Daytona sandbox with dedicated file system, Bash, and LSP intelligence.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <h4 className="font-semibold text-slate-900 mb-1">GitHub PR Automation</h4>
                <p className="text-slate-600 text-[13px]">
                  Connect GitHub repos to trigger autonomous issue-to-PR resolution with verified test runs.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <h4 className="font-semibold text-slate-900 mb-1">Security & Isolation</h4>
                <p className="text-slate-600 text-[13px]">
                  Zero access to host machines. Ephemeral sandboxes auto-destroy upon PR completion.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <h4 className="font-semibold text-slate-900 mb-1">CLI & API Integration</h4>
                <p className="text-slate-600 text-[13px]">
                  Trigger tasks via REST API, webhooks, or the <code>agentc</code> CLI tool.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setDocsModalOpen(false)}
                className="obsidian-glass-button px-6 h-11 rounded-full text-white text-[13.5px] font-medium transition-all shadow-sm cursor-pointer"
              >
                Close Docs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. "Customers" Modal */}
      {customersModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setCustomersModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-[0_25px_70px_-15px_rgba(15,23,42,0.28),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 relative max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setCustomersModalOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <AgentLogo size={32} />
              <span className="text-[17px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100/80 backdrop-blur-md text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Beta
              </span>
            </div>
            <h3 className="text-[21px] font-bold text-slate-950 mb-1">
              Customer Stories & Metrics
            </h3>
            <p className="text-[14px] text-slate-600 leading-relaxed mb-6">
              Engineering teams use AgentC to eliminate backlog churn and ship verified features autonomously.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-[13.5px]">
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <span className="text-[22px] font-bold text-slate-950 block mb-0.5">
                  4.2x faster
                </span>
                <h4 className="font-semibold text-slate-800 mb-1">
                  PR Merging Velocity
                </h4>
                <p className="text-slate-600 text-[13px]">
                  "Instead of engineers context-switching on test regressions, AgentC healed Vitest suites in isolated Daytona sandboxes automatically."
                </p>
                <span className="text-[11px] text-slate-400 block mt-2 font-medium">
                  VP of Engineering · HyperScale Inc.
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <span className="text-[22px] font-bold text-slate-950 block mb-0.5">
                  88% reduction
                </span>
                <h4 className="font-semibold text-slate-800 mb-1">
                  Flaky Test Debug Time
                </h4>
                <p className="text-slate-600 text-[13px]">
                  "Zero host setup required. Every pull request runs in a clean Daytona ephemeral container with complete tool autonomy."
                </p>
                <span className="text-[11px] text-slate-400 block mt-2 font-medium">
                  Head of Platform · Series B Fintech
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  setCustomersModalOpen(false);
                  setDemoModalOpen(true);
                }}
                className="text-[13.5px] font-semibold text-slate-800 hover:text-slate-950 hover:underline cursor-pointer"
              >
                Schedule an enterprise briefing →
              </button>
              <button
                onClick={() => setCustomersModalOpen(false)}
                className="obsidian-glass-button px-6 h-11 rounded-full text-white text-[13.5px] font-medium transition-all shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. "Pricing" Modal */}
      {pricingModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPricingModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-2xl rounded-3xl p-5 sm:p-7 max-w-3xl w-full shadow-[0_25px_70px_-15px_rgba(15,23,42,0.28),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 relative max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPricingModalOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <AgentLogo size={32} />
              <span className="text-[17px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100/80 backdrop-blur-md text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Beta
              </span>
            </div>
            <h3 className="text-[21px] font-bold text-slate-950 mb-1">
              Transparent, Developer-First Pricing
            </h3>
            <p className="text-[13.5px] text-slate-600 leading-relaxed mb-4">
              Start free with Daytona cloud sandboxes. Upgrade as your team automates pull requests.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-4 text-[13px]">
              {/* Tier 1: Community */}
              <div className="p-4 sm:p-4.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-[15px]">Community</h4>
                  <div className="my-1.5">
                    <span className="text-[24px] font-bold text-slate-950">$0</span>
                    <span className="text-slate-500 text-[12px]"> / month</span>
                  </div>
                  <p className="text-slate-600 text-[12px] mb-3">
                    For individual builders exploring autonomous agents.
                  </p>
                  <ul className="space-y-1.5 text-[12px] text-slate-700">
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>5 Autonomous PRs / week</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>Ephemeral Daytona sandboxes</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>Web workspace UI</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setPricingModalOpen(false);
                    onGetStarted();
                  }}
                  className="w-full mt-4 h-9 rounded-full border border-slate-200/90 bg-white/90 hover:bg-white text-slate-900 text-[12.5px] font-medium transition-all shadow-xs cursor-pointer"
                >
                  Start Free
                </button>
              </div>

              {/* Tier 2: Pro */}
              <div className="p-4 sm:p-4.5 rounded-2xl border-2 border-slate-950 bg-white/95 backdrop-blur-sm shadow-md flex flex-col justify-between relative">
                <span className="absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-950 text-white">
                  POPULAR
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 text-[15px]">Pro Team</h4>
                  <div className="my-1.5">
                    <span className="text-[24px] font-bold text-slate-950">$20</span>
                    <span className="text-slate-500 text-[12px]"> / user / mo</span>
                  </div>
                  <p className="text-slate-600 text-[12px] mb-3">
                    For agile engineering squads shipping daily.
                  </p>
                  <ul className="space-y-1.5 text-[12px] text-slate-700">
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>Unlimited Autonomous PRs</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>Fast NVMe Daytona Sandboxes</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>Full CLI & GitHub App</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>Automated Test Suite Healer</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setPricingModalOpen(false);
                    setEarlyAccessModalOpen(true);
                  }}
                  className="obsidian-glass-button w-full mt-4 h-9 rounded-full text-white text-[12.5px] font-medium transition-all shadow-sm cursor-pointer"
                >
                  Get Started
                </button>
              </div>

              {/* Tier 3: Enterprise */}
              <div className="p-4 sm:p-4.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-[15px]">Enterprise</h4>
                  <div className="my-1.5">
                    <span className="text-[24px] font-bold text-slate-950">Custom</span>
                  </div>
                  <p className="text-slate-600 text-[12px] mb-3">
                    Dedicated VPCs, custom models, and compliance.
                  </p>
                  <ul className="space-y-1.5 text-[12px] text-slate-700">
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>Self-hosted Daytona cluster</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>Custom LLM routing & fine-tunes</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>SAML SSO & Audit Logs</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>Dedicated Slack channel & SLA</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setPricingModalOpen(false);
                    setDemoModalOpen(true);
                  }}
                  className="w-full mt-4 h-9 rounded-full border border-slate-200/90 bg-white/90 hover:bg-white text-slate-900 text-[12.5px] font-medium transition-all shadow-xs cursor-pointer"
                >
                  Contact Sales
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setPricingModalOpen(false)}
                className="obsidian-glass-button px-6 h-10 rounded-full text-white text-[13px] font-medium transition-all shadow-sm cursor-pointer"
              >
                Close Pricing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. "Blog" Modal */}
      {blogModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setBlogModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-2xl rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-[0_25px_70px_-15px_rgba(15,23,42,0.28),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 relative max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBlogModalOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <AgentLogo size={32} />
              <span className="text-[17px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100/80 backdrop-blur-md text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Beta
              </span>
            </div>
            <h3 className="text-[21px] font-bold text-slate-950 mb-1">
              Engineering Blog
            </h3>
            <p className="text-[13.5px] text-slate-600 leading-relaxed mb-4">
              Deep dives on autonomous SWE agents, Daytona sandboxing, and benchmark evals.
            </p>

            <div className="space-y-2.5 mb-5 text-[13.5px]">
              <article className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-slate-300 transition-colors backdrop-blur-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Architecture · 5 min read
                </span>
                <h4 className="font-bold text-slate-950 text-[14.5px] mb-1">
                  How AgentC Heals Broken Vitest Suites Inside Daytona Sandboxes
                </h4>
                <p className="text-slate-600 text-[12.5px]">
                  A walkthrough of how the runner bot diagnoses stack traces, inspects LSP errors, and iterates until all unit tests pass before opening a PR.
                </p>
              </article>

              <article className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-slate-300 transition-colors backdrop-blur-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Security · 4 min read
                </span>
                <h4 className="font-bold text-slate-950 text-[14.5px] mb-1">
                  Zero-Trust Isolation: Why Ephemeral Sandboxes Matter for AI Coding
                </h4>
                <p className="text-slate-600 text-[12.5px]">
                  Why running untrusted code on local dev machines is a liability, and how isolated NVMe containers provide complete tool freedom without risk.
                </p>
              </article>

              <article className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-slate-300 transition-colors backdrop-blur-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Benchmarks · 6 min read
                </span>
                <h4 className="font-bold text-slate-950 text-[14.5px] mb-1">
                  Benchmarking SWE Intelligence on SWE-Bench Verified Repositories
                </h4>
                <p className="text-slate-600 text-[12.5px]">
                  Evaluating multi-turn reasoning loops, bash command feedback loops, and repo-wide AST comprehension on real GitHub issues.
                </p>
              </article>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setBlogModalOpen(false)}
                className="obsidian-glass-button px-6 h-10 rounded-full text-white text-[13px] font-medium transition-all shadow-sm cursor-pointer"
              >
                Close Blog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. "Privacy Policy" Modal - Zero-Trust Daytona Sandbox Architecture */}
      {privacyModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPrivacyModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-2xl rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-[0_25px_70px_-15px_rgba(15,23,42,0.28),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 relative max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPrivacyModalOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <AgentLogo size={32} />
              <span className="text-[17px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Zero-Trust Security
              </span>
            </div>

            <h3 className="text-[21px] font-bold text-slate-950 mb-1">
              Privacy & Security Policy
            </h3>
            <p className="text-[13.5px] text-slate-600 leading-relaxed mb-4">
              Your source code and repository data belong exclusively to you. Here is our architectural privacy guarantee:
            </p>

            {/* Core User Promoted Promise Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 backdrop-blur-sm mb-4 border border-emerald-200/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
              <div className="flex items-center gap-2 text-emerald-700 text-[12px] font-semibold uppercase tracking-wider mb-1">
                <Check size={14} />
                <span>Architectural Guarantee</span>
              </div>
              <p className="text-[15px] font-semibold leading-snug text-slate-900">
                Encrypted with zero-trust Daytona sandbox isolation.
              </p>
              <p className="text-[12.5px] text-slate-600 mt-1">
                Every agent task executes in a hardware-isolated, single-tenant container that is completely destroyed the moment your PR is delivered.
              </p>
            </div>

            {/* 4 Pillars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-[12.5px]">
              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <h4 className="font-bold text-slate-950 text-[13.5px] mb-1">
                  1. Ephemeral Sandboxes
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  No local machines or shared servers. Containers run on dedicated NVMe Daytona microVMs with strict firewall egress controls.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <h4 className="font-bold text-slate-950 text-[13.5px] mb-1">
                  2. End-to-End Encryption
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  TLS 1.3 encryption in transit for all websocket streams and AES-256 at-rest encryption across AST caches and diff blobs.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <h4 className="font-bold text-slate-950 text-[13.5px] mb-1">
                  3. Zero Model Training
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  We never train public, foundation, or proprietary AI models on your private repository files, commit logs, or prompt history.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-sm">
                <h4 className="font-bold text-slate-950 text-[13.5px] mb-1">
                  4. Complete Wipe on Exit
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Disk partitions, bash history, and transient tokens are securely shredded immediately upon session completion.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setPrivacyModalOpen(false)}
                className="obsidian-glass-button px-6 h-10 rounded-full text-white text-[13px] font-medium transition-all shadow-sm cursor-pointer"
              >
                Close Policy
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 12. Full-Screen Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[100] bg-white flex flex-col justify-between p-6 sm:p-8 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] h-[100dvh] max-h-[100dvh] animate-in fade-in duration-200 md:hidden overflow-y-auto no-scrollbar ios-scroll overscroll-contain"
          style={{
            fontFamily:
              "'NB International Pro', 'nbInternationalPro', system-ui, sans-serif",
          }}
        >
          {/* Top Header inside Full-Screen Menu */}
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <AgentLogo size={32} />
              <span className="text-[18px] font-bold tracking-tight text-slate-950 flex items-center">
                cloud<span className="font-normal text-slate-700">agent</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100/90 text-slate-600 border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                Beta
              </span>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-950 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
          </div>

          {/* Navigation Links - Large, clean, professional touch targets */}
          <div className="flex-1 py-8 flex flex-col justify-center space-y-2 shrink-0">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setAboutModalOpen(true);
              }}
              className="w-full py-4 text-left text-[24px] font-medium text-slate-900 hover:text-slate-950 flex items-center justify-between border-b border-slate-100/80 cursor-pointer transition-colors group"
            >
              <span>Product</span>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setPricingModalOpen(true);
              }}
              className="w-full py-4 text-left text-[24px] font-medium text-slate-900 hover:text-slate-950 flex items-center justify-between border-b border-slate-100/80 cursor-pointer transition-colors group"
            >
              <span>Pricing</span>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setBlogModalOpen(true);
              }}
              className="w-full py-4 text-left text-[24px] font-medium text-slate-900 hover:text-slate-950 flex items-center justify-between border-b border-slate-100/80 cursor-pointer transition-colors group"
            >
              <span>Blog</span>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setPrivacyModalOpen(true);
              }}
              className="w-full py-4 text-left text-[24px] font-medium text-slate-900 hover:text-slate-950 flex items-center justify-between border-b border-slate-100/80 cursor-pointer transition-colors group"
            >
              <span>Privacy</span>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
            </button>
          </div>

          {/* Action Buttons & Footer at bottom */}
          <div className="pt-6 border-t border-slate-100 space-y-3 shrink-0">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onGetStarted();
              }}
              className="obsidian-glass-button w-full h-12 rounded-full text-white text-[15px] font-medium transition-all cursor-pointer flex items-center justify-center shadow-sm"
            >
              <span className="relative z-10">Get started</span>
            </button>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setDemoModalOpen(true);
                }}
                className="w-full h-11 rounded-full border border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-[14px] font-medium text-slate-800 transition-colors cursor-pointer"
              >
                Get a demo
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogin();
                }}
                className="w-full h-11 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[14px] font-medium text-slate-800 transition-colors cursor-pointer"
              >
                {userEmail ? "Dashboard" : "Login"}
              </button>
            </div>

            <div className="text-center pt-3 text-[12px] text-slate-400">
              © 2026 AgentC Inc. · by Studio1
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
