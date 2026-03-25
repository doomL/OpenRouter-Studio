import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  BotIcon,
  ImageIcon,
  VideoIcon,
  ZapIcon,
  LayersIcon,
  ShareIcon,
  CheckIcon,
  ArrowRightIcon,
  ServerIcon,
  CloudIcon,
} from "lucide-react";

const GITHUB_REPO = "https://github.com/doomL/OpenRouter-Studio";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const features = [
  {
    icon: BotIcon,
    title: "LLM Chat Nodes",
    description: "Connect to any text model on OpenRouter. GPT-4o, Claude, Gemini, Llama, and hundreds more.",
  },
  {
    icon: ImageIcon,
    title: "Image Generation",
    description: "Generate images with DALL-E, Flux, Stable Diffusion. Text-to-image and image-to-image.",
  },
  {
    icon: VideoIcon,
    title: "Video Generation",
    description: "Create videos with Veo 3.1, Sora 2, Seedance. Full control over duration, resolution, and audio.",
  },
  {
    icon: LayersIcon,
    title: "Visual Pipeline Builder",
    description: "Drag, drop, and connect nodes to build complex AI workflows. No code required.",
  },
  {
    icon: ZapIcon,
    title: "Run All in One Click",
    description: "Execute your entire pipeline with a single button. Nodes run in dependency order automatically.",
  },
  {
    icon: ShareIcon,
    title: "Export & Share",
    description: "Save workflows as JSON files. Share pipelines with your team or the community.",
  },
];

const plans = [
  {
    name: "Self-Hosted",
    price: "Free",
    period: "forever",
    description: "Run on your own machine. Full control, no limits.",
    icon: ServerIcon,
    cta: "View on GitHub",
    ctaHref: GITHUB_REPO,
    highlight: false,
    features: [
      "All node types (LLM, Image, Video)",
      "Unlimited workflows",
      "Your own OpenRouter API key",
      "No data leaves your machine",
      "Community support",
      "Open source (MIT)",
    ],
  },
  {
    name: "Cloud",
    price: "$5",
    period: "/month",
    description: "Hosted Studio — sign in and build without installing anything.",
    icon: CloudIcon,
    cta: "Start free",
    ctaHref: "/auth/register",
    highlight: true,
    features: [
      "Everything in Self-Hosted",
      "Cloud-hosted — nothing to install",
      "Account & saved sessions",
      "Bring your own OpenRouter API key",
      "Email support",
      "Automatic updates",
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="Logo" className="h-7 w-7" />
            <span className="text-base font-bold tracking-tight">
              <span className="text-[#ff6b35]">OpenRouter</span>{" "}
              <span className="text-foreground">Studio</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <GitHubIcon className="size-4" />
              GitHub
            </a>
            <Link
              href="/auth/login"
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-[#ff6b35] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e55a28] transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#ff6b35]/15 via-transparent to-transparent dark:from-[#ff6b35]/10" />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-4 py-1.5 text-xs text-[#c2410c] dark:text-[#ff9b70] mb-8">
            <ZapIcon className="size-3" />
            Video generation now in alpha
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] max-w-3xl mx-auto text-foreground">
            Build AI pipelines
            <br />
            <span className="bg-gradient-to-r from-[#ff6b35] to-[#ea580c] dark:to-[#ff9b70] bg-clip-text text-transparent">
              visually
            </span>
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            A node-based canvas to chain LLMs, image generation, and video generation.
            Connect to 300+ models through OpenRouter. No code required.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[#ff6b35] px-6 py-3 text-sm font-semibold text-white hover:bg-[#e55a28] transition-colors shadow-lg shadow-[#ff6b35]/25"
            >
              Start Building
              <ArrowRightIcon className="size-4" />
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <GitHubIcon className="size-4" />
              Self-Host Free
            </a>
          </div>

          {/* Hero visual: Canvas preview */}
          <div className="mt-16 mx-auto max-w-4xl rounded-2xl border border-border bg-card p-1 shadow-xl shadow-black/5 dark:shadow-black/40">
            <div className="rounded-xl bg-muted p-8 min-h-[400px] flex items-center justify-center relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-40 dark:opacity-20"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, var(--studio-dots) 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
              <div className="relative flex items-center gap-8 flex-wrap justify-center">
                <MockNode color="#6b7280" title="Prompt" subtitle="Describe a scene..." />
                <svg className="w-16 h-8 text-muted-foreground" viewBox="0 0 64 32">
                  <path d="M0 16 L56 16 M48 8 L56 16 L48 24" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <MockNode color="#7c3aed" title="LLM Chat" subtitle="GPT-4o" />
                <svg className="w-16 h-8 text-muted-foreground" viewBox="0 0 64 32">
                  <path d="M0 16 L56 16 M48 8 L56 16 L48 24" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <MockNode color="#ea580c" title="Image Gen" subtitle="DALL-E 3" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground">Everything you need to build AI workflows</h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Connect models, chain outputs, and generate content — all from a visual canvas.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ff6b35]/10 mb-4">
                  <f.icon className="size-5 text-[#ea580c] dark:text-[#ff6b35]" />
                </div>
                <h3 className="text-base font-semibold mb-2 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground">Simple, transparent pricing</h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Self-host for free or use the cloud app. You always bring your own OpenRouter API key.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 flex flex-col ${
                  plan.highlight
                    ? "border-[#ff6b35]/50 bg-[#ff6b35]/5 dark:bg-[#ff6b35]/10 shadow-lg shadow-[#ff6b35]/10 relative"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#ff6b35] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Cloud
                  </div>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <plan.icon className="size-5 text-[#ea580c] dark:text-[#ff6b35]" />
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                </div>
                <div className="mb-1">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
                      <CheckIcon className="size-4 text-[#ea580c] dark:text-[#ff6b35] mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.ctaHref}
                  target={plan.ctaHref.startsWith("http") ? "_blank" : undefined}
                  rel={plan.ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}
                  className={`block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? "bg-[#ff6b35] text-white hover:bg-[#e55a28]"
                      : "border border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold mb-4 text-foreground">Ready to build?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Start building AI pipelines in minutes. Free to self-host, or sign up for cloud access.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[#ff6b35] px-6 py-3 text-sm font-semibold text-white hover:bg-[#e55a28] transition-colors"
            >
              Get Started Free
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Logo" className="h-5 w-5" />
            <span className="text-sm text-muted-foreground">OpenRouter Studio</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              OpenRouter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MockNode({ color, title, subtitle }: { color: string; title: string; subtitle: string }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg min-w-[140px]">
      <div className="rounded-t-lg px-3 py-1.5 text-[11px] font-semibold text-white" style={{ backgroundColor: color }}>
        {title}
      </div>
      <div className="p-3">
        <div className="text-[10px] text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}
