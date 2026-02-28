import { useEffect, useMemo, useState, type ReactNode } from "react";

const API_BASE = (() => {
  const env = import.meta.env.VITE_API_BASE;
  if (env) return env;
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.port === "5713") url.port = "4000";
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.origin;
  }
  return "";
})();

const CACHET_BASE = "https://cachet.dunkirk.sh";
const CDN_BASE = import.meta.env.VITE_CDN_BASE || "";
function toCdnUrl(path: string | null | undefined) {
  if (!path) return "";
  const s = String(path).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (!CDN_BASE) return s;
  return `${CDN_BASE.replace(/\/$/, "")}/${s.replace(/^\//, "")}`;
}
// Placeholder CDN links (configurable via Vite env)
const PLACEHOLDER_LOGO = import.meta.env.VITE_PLACEHOLDER_LOGO || "https://cdn.hackclub.com/019c6c84-9cce-7375-ba4a-808317e0986a/logo.png";
const PLACEHOLDER_COVER = import.meta.env.VITE_PLACEHOLDER_COVER || "https://placehold.co/180x120?text=Cover";
const PLACEHOLDER_COVER_1 = import.meta.env.VITE_PLACEHOLDER_COVER_1 || "https://placehold.co/180x120?text=Cover+1";
const PLACEHOLDER_COVER_2 = import.meta.env.VITE_PLACEHOLDER_COVER_2 || "https://placehold.co/180x120?text=Cover+2";
const PLACEHOLDER_COVER_3 = import.meta.env.VITE_PLACEHOLDER_COVER_3 || "https://placehold.co/180x120?text=Cover+3";
const PLACEHOLDER_COVER_4 = import.meta.env.VITE_PLACEHOLDER_COVER_4 || "https://placehold.co/180x120?text=Cover+4";
const PLACEHOLDER_CASSOS = import.meta.env.VITE_PLACEHOLDER_CASSOS || "https://cdn.hackclub.com/019c6f69-6b4c-7c4a-91fb-287dfc078625/Cassos.png";
const GUIDE_INTRO_TO_CAD = "/assets/guides/introToCAD.pdf";
const GUIDE_SPRIG_ENCLOSURE = "/assets/guides/sprigEnclosure.pdf";

function shopImagePathFromTitle(title: string) {
  return `/shop/${String(title).replace(/\s+/g, "")}.png`;
}

const DESIGN_GUIDES = [
  {
    key: "intro-to-cad",
    title: "Intro to CAD (Fusion 360)",
    description:
      "This in-depth guide gives you a full introduction to CAD using Fusion 360. You will learn how to build core shapes and combine them into one project, while picking up key concepts like tolerance along the way.",
    pdf: GUIDE_INTRO_TO_CAD,
  },
  {
    key: "sprig-enclosure",
    title: "Sprig Enclosure Guide",
    description:
      "Once you complete the Intro to CAD guide, or if you already know Fusion 360, this guide walks through the basics of starting a Sprig enclosure. Add your own creative touches if you want to submit it for tokens.",
    pdf: GUIDE_SPRIG_ENCLOSURE,
  },
] as const;

function ActionLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        aria-hidden="true"
        style={{ display: "inline-flex", width: 18, height: 18 }}
      >
        {icon}
      </span>
      <span>{text}</span>
    </span>
  );
}

function SubmitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h8v3a4 4 0 0 1-8 0V6Z" />
      <path d="M6 6H4v1a3 3 0 0 0 3 3" />
      <path d="M18 6h2v1a3 3 0 0 1-3 3" />
      <path d="M12 13v4" />
      <path d="M9 21h6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
      <path d="M15 5l4 4" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l1 5H5l1-5Z" />
      <path d="M4 8h16l-1.5 12h-13L4 8Z" />
      <path d="M9 12a3 3 0 1 0 6 0" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V6" />
      <path d="m8 10 4-4 4 4" />
      <path d="M4 18h16" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function CassosIcon() {
  return (
    <img
      src={PLACEHOLDER_CASSOS}
      alt=""
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}

function DesignGuideModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="guide-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="guide-modal-head">
          <h3 id="design-guide-title">Design Guides</h3>
          <button
            className="guide-close"
            type="button"
            onClick={onClose}
            aria-label="Close design guides"
          >
            Close
          </button>
        </div>
        <p className="guide-modal-sub">
          Start with Intro to CAD, then build your own spin with the Sprig
          Enclosure Guide.
        </p>
        <div className="guide-grid">
          {DESIGN_GUIDES.map((guide) => (
            <article key={guide.key} className="guide-card">
              <h4>{guide.title}</h4>
              <p>{guide.description}</p>
              <a
                href={guide.pdf}
                target="_blank"
                rel="noreferrer"
                className="guide-preview"
                aria-label={`Open ${guide.title} PDF`}
              >
                <iframe
                  title={`${guide.title} preview`}
                  src={`${guide.pdf}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                />
              </a>
              <div className="guide-actions">
                <a
                  href={guide.pdf}
                  target="_blank"
                  rel="noreferrer"
                  className="btn secondary"
                >
                  Open PDF
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

const faqItems = [
  {
    key: "design",
    question: "What exactly do I design?",
    answer: (
      <p>
        You design <b>an enclosure</b>, basically a case or cover. It can be
        protective, decorative, weird, chunky, minimal, or cursed. As long as
        it is printable, you are good to go.
      </p>
    ),
  },
  {
    key: "devices",
    question: "Which devices are allowed?",
    answer: (
      <p>
       Any device is allowed. 
       However, if your device is extremely large or unusually shaped, we may ask you to modify the design.
      </p>
    ),
  },
  {
    key: "printer",
    question: "Do I need a 3D printer?",
    answer: <p>Nope. You design it, we print it, and we ship it to you.</p>,
  },
  {
    key: "hackatime",
    question: "Is Lapse/Hackatime required?",
    answer: (
      <p>
        Lapse or Hackatime is only required if you want to earn shop rewards.
        If you only want your enclosure printed and shipped, you do not need
        time tracking. To qualify for shop rewards, keep a short project
        journal on Gist and include the link with your submission.
      </p>
    ),
  },
  {
    key: "format",
    question: "What file format do I submit?",
    answer: (
      <p>
        STP or STEP files are preferred. If you are unsure, export STP and you
        will be fine.
      </p>
    ),
  },
  {
    key: "double-dip",
    question: "Is double dipping allowed?",
    answer: (
      <p>
        You can double dip with other programs if you are not opting into shop
        rewards. If you are opting into shop rewards, you cannot double dip
        with other programs.
      </p>
    ),
  },
  {
    key: "free",
    question: "Is this actually free?",
    answer: (
      <p>
        Yes. This is a Hack Club You Ship, We Ship program. We cover printing
        and shipping.
      </p>
    ),
  },
  {
    key: "more",
    question: "More questions?",
    answer: (
      <p>
        If you have more questions, join{" "}
        <a
          href="https://hackclub.enterprise.slack.com/archives/C092D99G1RU"
          target="_blank"
          rel="noreferrer"
        >
          #enclosure
        </a>{" "}
        on Hack Club Slack, we have an amazing community to answer your
        questions!
      </p>
    ),
  },
];

const steps: Array<{ title: string; body: string; tag: string; icon: ReactNode }> = [
  {
    title: "1. Design",
    body: "Measure your device carefully, then design your enclosure in Fusion or Onshape. Button cutouts, camera bumps, and ports all matter. Add grip, texture, logos, and chaos.",
    tag: "accuracy + CAD time",
    icon: <PencilIcon />,
  },
  {
    title: "2. Submit",
    body: "Upload your CAD file through the submission form. We will sanity-check it before printing.",
    tag: "STP / STEP",
    icon: <UploadIcon />,
  },
  {
    title: "3. Ship",
    body: "We 3D print your enclosure and ship it straight to you. Yes, for real.",
    tag: "free plastic",
    icon: <BoxIcon />,
  },
  {
    title: "4. Earn Cassos",
    body: "Use cassos to redeem awesome shop items that help you along your CAD journey.",
    tag: "shop rewards",
    icon: <CassosIcon />,
  },
];

const requirements = [
  {
    icon: "🧪",
    title: "Original design only",
    body: "Make something uniquely yours. No remixes of other people’s models.",
    tag: "keep it yours",
  },
  {
    icon: "🙅‍♂️",
    title: "No AI-generated CAD",
    body: "Hand-made in Fusion or Onshape. We want your brain, not a prompt.",
    tag: "human-made",
  },
  {
    icon: "🛠️",
    title: "Fusion or Onshape",
    body: "Submit native files or exports from these tools for the smoothest review.",
    tag: "supported CAD",
  },
  {
    icon: "📓",
    title: "Journal required",
    body: "Create a project journal on Gist documenting progress, decisions, and changes. Include a link to it in your submission.",
    tag: "github",
  },
  {
    icon: "📏",
    title: "Stay within size",
    body: "Keep your enclosure within the posted build volume to avoid scaling.",
    tag: "fit the bed",
  },
  {
    icon: "🎒",
    title: "Age restriction",
    body: "Anyone aged 13 to 18 can participate.",
    tag: "play nice",
  },
  
];

function Hero({ onOpenGuides }: { onOpenGuides: () => void }) {
  return (
    <section className="hero">
      <div className="hero-inner">
        <a target="_blank" rel="noreferrer" href="https://cad.hackclub.com">
          <div className="ysws-badge">Hack Club · CAD YSWS</div>
        </a>
        <div className="hero-visual">
          <img
            className="hero-logo"
            src={PLACEHOLDER_LOGO}
            alt="Enclosure logo"
          />
          <div className="covers-wrap">
            <div className="cover-img cover-1">
              <a href="https://github.com/taciturnaxolotl/inky" target="_blank" rel="noreferrer">
                <img
                  src={PLACEHOLDER_COVER_1}
                  alt="Enclosure cover example 1"
                />
              </a>
            </div>
            <div className="cover-img cover-2">
              <img
                src={PLACEHOLDER_COVER_2}
                alt="Enclosure cover example 2"
              />
            </div>
            <div className="cover-img cover-3">
              <img
                src={PLACEHOLDER_COVER_3}
                alt="Enclosure cover example 3"
              />
            </div>
            <div className="cover-img cover-4">
              <img
                src={PLACEHOLDER_COVER_4}
                alt="Enclosure cover example 4"
              />
            </div>
          </div>
        </div>
        <p>
          <b>
            Design a custom enclosure for your project, get a 3D print of it <br></br>shipped to you, and win other prizes!
          </b>
        </p>
      

        <div className="buttons-wrap">
          <div className="buttons">
            <div className="buttons-row top" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 32 }}>
              <a href="https://forms.hackclub.com/enclosure" target="_blank">
                <button
                  className="btn"
                  type="button"
                >
                  <ActionLabel icon={<SubmitIcon />} text="Submit your project" />
                </button>
              </a>
              <a href="/shop">
                <button className="btn secondary" type="button">
                  <ActionLabel icon={<ShopIcon />} text="Visit the shop" />
                </button>
              </a>
              <a
                target="_blank"
                rel="noreferrer"
                href="https://hackclub.enterprise.slack.com/archives/C092D99G1RU"
              >
                <button className="btn secondary" type="button">
                  <ActionLabel icon={<ChatIcon />} text="Join Slack" />
                </button>
              </a>
            </div>
            <div className="buttons-row bottom">
              <button
                className="btn secondary"
                type="button"
                onClick={onOpenGuides}
              >
                <ActionLabel icon={<PencilIcon />} text="Design Guide" />
              </button>
              <a href="/weekly-challenges">
                <button className="btn secondary" type="button">
                  <ActionLabel icon={<TrophyIcon />} text="Weekly Challenges" />
                </button>
              </a>
              <a
                target="_blank"
                rel="noreferrer"
                href="https://forms.hackclub.com/enclosure-workshop"
              >
                <button className="btn secondary" type="button">
                  <ActionLabel icon={<MicIcon />} text="Run a workshop" />
                </button>
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="container">
        <h2>How Enclosure Works</h2>
        <div className="section-note">
          How plastic ends up at your door
        </div>
        <div className="grid">
          {steps.map((step) => (
            <div key={step.title} className="card">
              <h3 style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  aria-hidden="true"
                  style={{ display: "inline-flex", width: 44, height: 44, flexShrink: 0 }}
                >
                  {step.icon}
                </span>
                <span>{step.title}</span>
              </h3>
              <p>{step.body}</p>
              <span className="tag">{step.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Paths({ onOpenGuides }: { onOpenGuides: () => void }) {
  return (
    <section className="section" id="paths">
      <div className="container">
        <h2>Choose Your Path</h2>
        <div className="section-note">Choose the path that fits your experience</div>
        <div className="grid" style={{ gap: 28, alignItems: 'stretch' }}>
          <div className="card" style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 360 }}>
            <h3 style={{ marginTop: 0 }}>Design & Ship</h3>
            <p style={{ marginTop: 6 }}>
              Submit your CAD file, and our team will 3D print and ship the
              finished enclosure to you. This path does not require Hackatime,
              so it is ideal if you only want your design printed.
            </p>

            <div style={{ marginTop: 10 }}>
              <strong>How it works</strong>
              <ol style={{ marginTop: 8 }}>
                <li>Export a clean STP / STEP (or compatible) file.</li>
                <li>Submit via the short form, including device notes and tolerances.</li>
                <li>We review for printability and may ask for minor tweaks.</li>
                <li>We print, finish, and ship (typical turnaround is 2 to 4 weeks).</li>
              </ol>
            </div>

            <ul style={{ marginTop: 10, color: 'var(--muted)' }}>
              <li>No Hackatime required</li>
              <li>We handle print preparation and shipping</li>
              <li>Expected turnaround: about 2 to 4 weeks (varies by volume)</li>
            </ul>

            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <a href="https://forms.hackclub.com/enclosure" target="_blank" rel="noreferrer">
                <button className="btn">Submit design</button>
              </a>
              <button
                className="btn secondary"
                type="button"
                onClick={onOpenGuides}
              >
                <ActionLabel icon={<PencilIcon />} text="Design Guide" />
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 360 }}>
            <h3 style={{ marginTop: 0 }}>Earn Shop Items</h3>
            <p style={{ marginTop: 6 }}>
              Track your hours with Hackatime or Lapse to unlock shop tiers and
              prizes. Verified hours determine which rewards you can claim. Value is
              set at <strong>5 Cassos = $1</strong>, with payouts targeted around
              <strong> 20 Cassos per verified hour</strong>.
            </p>

            <div style={{ marginTop: 8, color: '#ffd166', fontWeight: 800 }}>
               Journaling required: create a project journal on <a href="https://gist.github.com/" target="_blank" rel="noreferrer" style={{ color: 'white' }}>Gist</a> and include the link in your submission.
            </div>

            <div style={{ marginTop: 10 }}>
              <strong>What to expect</strong>
              <ol style={{ marginTop: 8 }}>
                <li>Sign in to Hackatime (or Lapse) and enable tracking for your sessions.</li>
                <li>Accumulate hours to earn cassos and unlock shop rewards.</li>
                <li>When you reach a tier, you'll be eligible to claim items from the shop.</li>
                <li>Verification and fulfillment may take 1 to 3 weeks after claiming.</li>
              </ol>
            </div>

            <ul style={{ marginTop: 10, color: 'var(--muted)' }}>
              <li>Requires Hackatime/Lapse to count hours</li>
              <li>Tier 3 = starter rewards, Tier 2 = stronger tools and printers, Tier 1 = best rewards</li>
              <li>Prizes are shipped once verified</li>
            </ul>

            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <a href="https://hackatime.hackclub.com" target="_blank" rel="noreferrer">
                <button className="btn secondary">Track hours</button>
              </a>
              <a href="/shop">
                <button className="btn">View Shop</button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <section className="section" id="gallery">
      <div className="container">
        <h2>Things Other People Made</h2>
        <div className="gallery-locked">
          <div className="grid">
            <div className="gallery-box" />
            <div className="gallery-box" />
            <div className="gallery-box" />
            <div className="gallery-box" />
          </div>
          <div className="lock-overlay">🔒 Coming soon</div>
        </div>
      </div>
    </section>
  );
}

function Shop() {
  const tiers = [
    {
      title: "Tier 3 - Starter Rewards",
      direction: "normal" as const,
      items: [
        { label: "iFixit Anti-Static Wrist Strap", note: "20 Cassos · about 1h", img: "https://placehold.co/200x140?text=Anti-Static+Strap" },
        { label: "Bambu Lab PLA Basic Filament 1kg", note: "100 Cassos · about 5h", img: "https://placehold.co/200x140?text=PLA+Basic+1kg" },
        { label: "iFixit Moray Driver Kit", note: "100 Cassos · about 5h", img: "https://placehold.co/200x140?text=Moray+Driver+Kit" },
        { label: "ENGINEER SS-02 Solder Sucker", note: "110 Cassos · about 5.5h", img: "https://placehold.co/200x140?text=Engineer+SS-02" },
      ],
    },
    {
      title: "Tier 2 - Advanced Rewards",
      direction: "reverse" as const,
      items: [
        { label: "Pinecil V2 Smart Soldering Iron", note: "200 Cassos · about 10h", img: "https://placehold.co/200x140?text=Pinecil+V2" },
        { label: "Raspberry Pi Zero 2 W Starter Kit", note: "225 Cassos · about 11.25h", img: "https://placehold.co/200x140?text=Pi+Zero+2+W+Kit" },
        { label: "YubiKey 5 NFC", note: "250 Cassos · about 12.5h", img: "https://placehold.co/200x140?text=YubiKey+5+NFC" },
        { label: "iFixit Pro Tech Toolkit", note: "375 Cassos · about 18.75h", img: "https://placehold.co/200x140?text=Pro+Tech+Toolkit" },
        { label: "TS101 USB-C Soldering Iron Kit", note: "450 Cassos · about 22.5h", img: "https://placehold.co/200x140?text=TS101+Kit" },
        { label: "Logitech MX Master 3S", note: "500 Cassos · about 25h", img: "https://placehold.co/200x140?text=MX+Master+3S" },
        { label: "Hakko FX-888DX Soldering Station", note: "600 Cassos · about 30h", img: "https://placehold.co/200x140?text=Hakko+FX-888DX" },
        { label: "Raspberry Pi 5 8GB", note: "625 Cassos · about 31.25h", img: "https://placehold.co/200x140?text=Raspberry+Pi+5+8GB" },
        { label: "Raspberry Pi 500", note: "650 Cassos · about 32.5h", img: "https://placehold.co/200x140?text=Raspberry+Pi+500" },
        { label: "Flipper Zero", note: "995 Cassos · about 49.75h", img: "https://placehold.co/200x140?text=Flipper+Zero" },
        { label: "Sony WH-1000XM4", note: "1,000 Cassos · about 50h", img: "https://placehold.co/200x140?text=WH-1000XM4" },
        { label: "Creality Ender-3 V3 KE", note: "1,400 Cassos · about 70h", img: "https://placehold.co/200x140?text=Ender-3+V3+KE" },
        { label: "Bambu Lab AMS lite", note: "1,400 Cassos · about 70h", img: "https://placehold.co/200x140?text=Bambu+AMS+lite" },
        { label: "Bambu Lab A1 mini", note: "1,500 Cassos · about 75h", img: "https://placehold.co/200x140?text=Bambu+A1+mini" },
        { label: "Anycubic Kobra 2 Pro", note: "1,500 Cassos · about 75h", img: "https://placehold.co/200x140?text=Kobra+2+Pro" },
        { label: "ELEGOO Neptune 4 Pro", note: "1,500 Cassos · about 75h", img: "https://placehold.co/200x140?text=Neptune+4+Pro" },
        { label: "Meta Quest 3S 128GB", note: "1,500 Cassos · about 75h", img: "https://placehold.co/200x140?text=Quest+3S+128GB" },
        { label: "AnkerMake M5C", note: "2,000 Cassos · about 100h", img: "https://placehold.co/200x140?text=AnkerMake+M5C" },
      ],
    },
    {
      title: "Tier 1 - Best Rewards",
      direction: "normal" as const,
      items: [
        { label: "Creality K1C", note: "2,500 Cassos · about 125h", img: "https://placehold.co/200x140?text=Creality+K1C" },
        { label: "Bambu Lab P1P", note: "2,500 Cassos · about 125h", img: "https://placehold.co/200x140?text=Bambu+P1P" },
      ],
    },
  ];

  return (
    <section className="section" id="shop">
      <div className="container">
        <h2>SHOP</h2>
        <div className="section-note">prizes to power up your next build</div>
        <style>{`
          .shop-rail { margin: 16px 0 28px; border: 2px dashed var(--border); border-radius: 14px; background: rgba(255,183,3,0.08); overflow: hidden; position: relative; }
          .shop-rail h4 { margin: 10px 14px; font-family: 'Patrick Hand', cursive; font-size: 1.2rem; color: var(--accent2); }
          .shop-track { display: flex; gap: 16px; padding: 0 14px 16px 14px; animation: shop-scroll 28s linear infinite; width: max-content; }
          .shop-rail.reverse .shop-track { animation-direction: reverse; }
          .shop-card { min-width: 220px; background: var(--card); border: 2px dashed var(--border); border-radius: 14px; padding: 12px; box-shadow: 4px 4px 0 #000; transform: rotate(-1deg); display: grid; gap: 8px; flex: 0 0 auto; }
          .shop-card:nth-child(even) { transform: rotate(1deg); }
          .shop-card h5 { margin: 0 0 6px; font-family: 'Patrick Hand', cursive; font-size: 1.1rem; }
          .shop-card .note { color: var(--muted); font-size: 0.9rem; }
          .shop-img { width: 100%; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; border: 2px solid var(--border); background: #1c120d; display: flex; align-items: center; justify-content: center; }
          .shop-img img { width: 100%; height: 100%; object-fit: contain; display: block; max-width: 200px; max-height: 150px; background: #fff; }
          @keyframes shop-scroll { from { transform: translateX(0); } to { transform: translateX(calc(-1 * var(--scroll-distance, 50%))); } }
        `}</style>
        {tiers.map((tier) => {
          const repeats = 2;
          const rowItems = Array.from({ length: repeats }, () => tier.items).flat();
          const scrollDistance = 100 / repeats;
          const secondsPerItem = 2.5;
          const animationDuration = `${(tier.items.length * secondsPerItem).toFixed(1)}s`;
          return (
            <div key={tier.title} className={`shop-rail ${tier.direction === "reverse" ? "reverse" : ""}`}>
              <h4>{tier.title}</h4>
              <div
                className="shop-track"
                style={{
                  animationDuration,
                  // @ts-expect-error custom property
                  "--scroll-distance": `${scrollDistance}%`
                }}
              >
                {rowItems.map((item, i) => (
                  <div key={`${item.label}-${i}`} className="shop-card">
                    <div className="shop-img" aria-hidden>
                      <img
                        src={shopImagePathFromTitle(item.label)}
                        alt=""
                        onError={(event) => {
                          const img = event.currentTarget;
                          if (img.dataset.fallback === "1") return;
                          img.dataset.fallback = "1";
                          img.src = item.label.toLowerCase().includes("cassos")
                            ? PLACEHOLDER_CASSOS
                            : (item.img || PLACEHOLDER_COVER);
                        }}
                      />
                    </div>
                    <h5>{item.label}</h5>
                    <div className="note">{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="buttons-row" style={{ marginTop: 12, justifyContent: "center" }}>
        <button
          className="btn"
          type="button"
          onClick={() => {
            window.location.href = "/shop";
          }}
        >
          View full shop ↓
        </button>
      </div>
    </section>
  );
}

function Requirements() {
  return (
    <section className="section" id="rules">
      <div className="container">
        <h2>REQUIREMENTS</h2>
        <div className="section-note">
          we do not like them either, but printers do
        </div>
        <div className="rules">
          {requirements.map((req) => (
            <div key={req.title} className="rule-card">
              <div className="rule-icon" aria-hidden>
                {req.icon}
              </div>
              <div className="rule-body">
                <h3>{req.title}</h3>
                <p>{req.body}</p>
                <span className="rule-tag">{req.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [activeKey, setActiveKey] = useState<string>(faqItems[0]?.key ?? "");
  const activeItem = useMemo(
    () => faqItems.find((item) => item.key === activeKey) ?? faqItems[0],
    [activeKey],
  );

  return (
    <section className="section" id="faq">
      <div className="container">
        <h2>FAQs</h2>
        <div className="section-note">Questions you keep asking</div>
      </div>
      <div className="faq">
        <div className="faq-questions">
          {faqItems.map((item) => (
            <div
              key={item.key}
              className={`faq-q${item.key === activeKey ? " active" : ""}`}
              onClick={() => setActiveKey(item.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setActiveKey(item.key);
              }}
            >
              {item.question}
            </div>
          ))}
        </div>
        <div className="faq-answers">
          <h3>{activeItem?.question}</h3>
          <div>{activeItem?.answer}</div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      Enclosure is a Hack Club CAD YSWS
    </footer>
  );
}

export default function App() {
  const [slackAvatarUrl, setSlackAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [slackId, setSlackId] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [showSlackPopup, setShowSlackPopup] = useState(false);
  const [showDesignGuideModal, setShowDesignGuideModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/profile`, { credentials: "include" });
        if (res.status === 401) {
          // Not authenticated: redirect the browser to the identity provider
          const cont = window.location.origin;
          window.location.href = `${API_BASE}/api/auth/login?continue=${encodeURIComponent(cont)}&force=1`;
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data?.name) setDisplayName(data.name);
        let resolvedSlackId = typeof data?.slackId === "string" ? data.slackId : null;
        if (!resolvedSlackId) {
          try {
            const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
            if (meRes.ok) {
              const me = await meRes.json();
              const identity = (me && me.identity) || {};
              const hcSlackId = typeof identity?.slack_id === "string"
                ? identity.slack_id
                : typeof identity?.slackId === "string"
                  ? identity.slackId
                  : null;
              if (hcSlackId) resolvedSlackId = hcSlackId;
            }
          } catch (_err) {}
        }
        if (resolvedSlackId) setSlackId(resolvedSlackId);
        // Prefer avatar from backend, else Cachet CDN
        if (data?.image) {
          setSlackAvatarUrl(data.image);
        } else if (resolvedSlackId) {
          setSlackAvatarUrl(`${CACHET_BASE}/users/${resolvedSlackId}/r`);
        }
        if (typeof data?.credits === "number") setCredits(data.credits);
      } catch (_err) {}
    })();
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    if (!showSlackPopup) return;
    const handleClick = (e: MouseEvent) => {
      const popup = document.getElementById('slack-popup');
      const avatar = document.getElementById('slack-avatar');
      if (
        popup && !popup.contains(e.target as Node) &&
        avatar && !avatar.contains(e.target as Node)
      ) {
        setShowSlackPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSlackPopup]);

  useEffect(() => {
    if (!showDesignGuideModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDesignGuideModal(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDesignGuideModal]);

  // Warm the guide PDFs at app start so modal previews open faster.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const links: HTMLLinkElement[] = [];
    for (const guide of DESIGN_GUIDES) {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = guide.pdf;
      document.head.appendChild(link);
      links.push(link);
    }
    return () => {
      for (const link of links) {
        if (link.parentNode) link.parentNode.removeChild(link);
      }
    };
  }, []);

  const initials = (displayName || "HC")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "HC";

  return (
    <>
      <DesignGuideModal
        isOpen={showDesignGuideModal}
        onClose={() => setShowDesignGuideModal(false)}
      />
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: -9999,
          top: -9999,
          width: 2,
          height: 2,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        {DESIGN_GUIDES.map((guide) => (
          <iframe
            key={`prewarm-${guide.key}`}
            title={`Prewarm ${guide.title}`}
            src={`${guide.pdf}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            loading="eager"
          />
        ))}
      </div>
      
      <div
        id="slack-avatar"
        aria-label="Signed-in user"
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: "50%",
          border: "2px solid #000",
          background: "#f5f5f5",
          display: "grid",
          placeItems: "center",
          overflow: "visible",
          zIndex: 2000,
          boxShadow: "4px 4px 0 #000",
          fontWeight: 700,
        }}
        title={displayName || "User"}
      >
        {/* Credits display to the left of the avatar */}
          {typeof credits === "number" ? (
            <div
              style={{
                position: "absolute",
                right: 76,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 2100,
              }}
              title={String(credits)}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  background: "#fff",
                  border: "2px solid #b45309",
                  borderRadius: 12,
                  boxShadow: "2px 2px 0 #000",
                }}
              >
                <div style={{ fontWeight: 800, color: "#b45309", fontSize: 16, minWidth: 24, textAlign: "center" }}>{credits}</div>
                <img
                  src={PLACEHOLDER_CASSOS}
                  alt={typeof credits === 'number' ? `${credits} cassos` : 'cassos'}
                  style={{ width: 36, height: 42, display: 'block' }}
                />
              </div>
            </div>
          ) : null}
        {slackAvatarUrl ? (
          <img
            src={slackAvatarUrl}
            alt={displayName || "Slack profile"}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", cursor: 'pointer' }}
            onClick={e => {
              e.stopPropagation();
              setShowSlackPopup(true);
              setTimeout(() => {
                const input = document.getElementById('slack-id-input');
                if (input) input.focus();
              }, 100);
            }}
          />
        ) : (
          <span
            style={{ borderRadius: "50%", width: "100%", height: "100%", display: "grid", placeItems: "center", cursor: 'pointer' }}
            onClick={e => {
              e.stopPropagation();
              setShowSlackPopup(true);
              setTimeout(() => {
                const input = document.getElementById('slack-id-input');
                if (input) input.focus();
              }, 100);
            }}
          >{initials}</span>
        )}
        {showSlackPopup && (
          <div
            id="slack-popup"
            style={{
              position: "fixed",
              top: 90,
              right: 20,
              minWidth: 260,
              background: "#fff",
              border: "3px solid #b45309",
              borderRadius: 14,
              boxShadow: "0 8px 24px #0006",
              padding: "18px 22px",
              zIndex: 3000,
              color: "#222",
              fontSize: "1.1rem",
              fontWeight: 700,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ marginBottom: 8, color: '#b45309', fontWeight: 800, fontSize: '1.15rem' }}>
              Slack ID
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.25rem',
                padding: '10px 18px',
                border: '2px solid #b45309',
                borderRadius: 10,
                background: '#fffbe7',
                color: '#b45309',
                fontWeight: 700,
                minWidth: 120,
                marginBottom: 6,
                boxShadow: '2px 2px 0 #b45309',
                letterSpacing: '0.5px',
              }}
            >
              {slackId ? slackId : 'Slack ID not available'}
            </div>
            <div style={{ width: '100%', marginTop: 6 }}>
              <button
                type="button"
                onClick={() => { window.location.href = `${API_BASE}/api/auth/logout`; }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '2px solid #222',
                  background: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
      <a href="https://hackclub.com/">
        <img
          style={{
            position: "absolute",
            top: 0,
            left: 80,
            border: 0,
            width: 220,
            zIndex: 999,
          }}
          src="https://assets.hackclub.com/flag-orpheus-top.svg"
          alt="Hack Club"
        />
      </a>
      <Hero onOpenGuides={() => setShowDesignGuideModal(true)} />
      <HowItWorks />
      <Paths onOpenGuides={() => setShowDesignGuideModal(true)} />
      <Gallery />
      <Shop />
      <Requirements />
      <FAQ />
      <Footer />
    </>
  );
}
