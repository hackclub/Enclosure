import { useEffect, useMemo, useState, type ReactNode } from "react";
import GUIDE_INTRO_TO_CAD from "../guides/introToCAD.pdf";
import GUIDE_SPRIG_ENCLOSURE from "../guides/sprigEnclosure.pdf";

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
const PLACEHOLDER_COVER_1 = import.meta.env.VITE_PLACEHOLDER_COVER_1 || "/covers/cameraenclosure.png";
const PLACEHOLDER_COVER_2 = import.meta.env.VITE_PLACEHOLDER_COVER_2 || "/covers/robotenclosure.png";
const PLACEHOLDER_COVER_3 = import.meta.env.VITE_PLACEHOLDER_COVER_3 || "/covers/sprigenclosure.png";
const PLACEHOLDER_COVER_4 = import.meta.env.VITE_PLACEHOLDER_COVER_4 || "/covers/speakerenclosure.png";
const PLACEHOLDER_CASSOS = import.meta.env.VITE_PLACEHOLDER_CASSOS || "https://cdn.hackclub.com/019c6f69-6b4c-7c4a-91fb-287dfc078625/Cassos.png";
const SHOP_IMAGE_TITLES_IN_ORDER = [
  "iFixit Anti-Static Wrist Strap",
  "Bambu Lab PLA Basic Filament 1kg",
  "iFixit Moray Driver Kit",
  "ENGINEER SS-02 Solder Sucker",
  "Pinecil V2 Smart Soldering Iron",
  "Raspberry Pi Zero 2 W Starter Kit",
  "YubiKey 5 NFC",
  "iFixit Pro Tech Toolkit",
  "TS101 USB-C Soldering Iron Kit",
  "Logitech MX Master 3S",
  "Hakko FX-888DX Soldering Station",
  "Raspberry Pi 5 8GB",
  "Raspberry Pi 500",
  "Flipper Zero",
  "Sony WH-1000XM4",
  "Creality Ender-3 V3 KE",
  "Bambu Lab AMS lite",
  "Bambu Lab A1 mini",
  "Anycubic Kobra 2 Pro",
  "ELEGOO Neptune 4 Pro",
];

const SHOP_IMAGE_INDEX_BY_TITLE = new Map(
  SHOP_IMAGE_TITLES_IN_ORDER.map((title, index) => [title.toLowerCase(), index + 1])
);

function shopImagePathFromTitle(title: string) {
  const idx = SHOP_IMAGE_INDEX_BY_TITLE.get(String(title).trim().toLowerCase());
  if (idx) return `/shopimg/${idx}.png`;
  return `/shop/${String(title).replace(/\s+/g, "")}.png`;
}

function legacyShopImagePathFromTitle(title: string) {
  const idx = SHOP_IMAGE_INDEX_BY_TITLE.get(String(title).trim().toLowerCase());
  if (!idx) return null;
  return `/shop/${idx}.png`;
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
      "Once you complete the Intro to CAD guide, or if you already know Fusion 360, this guide walks through the basics of starting a Sprig enclosure.",
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
        Hackatime/Lapse is required if you want to be eligible for Tier 1 and Tier 2 prizes.
        <br />
        For club workshops, Hackatime/Lapse is not necessary to earn the club tier prize.
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
        Yes, you can double dip with Construct!
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
    body: "Measure your device carefully, then design your enclosure in Fusion or Onshape. Track your build time in Lapse as you work so your hours count toward tier prizes. Button cutouts, camera bumps, and ports all matter. Add grip, texture, logos, and chaos.",
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
    title: "4. Show Off & Enjoy",
    body: "Share your finished enclosure with the community and enjoy your tier grant card rewards.",
    tag: "showcase + rewards",
    icon: <TrophyIcon />,
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
    title: "Lapse + Journal required",
    body: "Track your build time in Lapse and create a project journal on Gist documenting progress, decisions, and changes. Include the journal link in your submission.",
    tag: "github",
  },
  {
    icon: "📏",
    title: "Stay within size",
    body: "Keep your enclosure dimensions practical for standard desktop 3D printers to avoid redesign requests.",
    tag: "fit the bed",
  },
  {
    icon: "🎒",
    title: "Age restriction",
    body: "Anyone aged 13 to 18 can participate.",
    tag: "play nice",
  },
  
];

  const individualPrizeTiers = [
    {
      name: "Tier 1 (Top-level)",
      hours: "5-10 hours",
      reward: "$15 grant card + special recognition or special reward.",
      details: [
        "Multi-part design with 4+ parts.",
        "Clear functional purpose beyond being only a container.",
        "Includes at least one mechanical interaction (hinge, slider, or lock).",
        "Includes structural or electronics planning (airflow, PCB mounts, or wire management).",
        "Submission includes design reasoning for major choices.",
      ],
    },
    {
      name: "Tier 2 (Mid-level)",
      hours: "3-5 hours",
      reward: "$10 grant card.",
      details: [
        "Multi-part design with 2+ parts.",
        "Functional part or enclosure.",
        "Includes a tolerance-aware feature (screw holes/inserts, snap fits/clips, or cable routing/ports).",
        "Submission explains fit/tolerance choices for selected features.",
        "Notes describe how parts assemble or fasten together.",
      ],
    },
    {
      name: "Tier 3 (Low-level)",
      hours: "1-3 hours",
      reward: "$5 grant card.",
      details: [
        "Single-part design with 1 STL only.",
        "No moving parts (decorative shell or simple cover only).",
        "Basic sizing is accurate for the target device or object.",
        "Design is suitable for envelope delivery.",
        "File is clean and print-ready (manifold, correctly scaled).",
      ],
    },
  ];

  const clubPrizeTier = {
    name: "Club Tier",
    hours: "Per person who ships",
    reward: "$5 grant card to each club member for every successful shipment",
  };

function Hero({ onOpenGuides, isAdmin }: { onOpenGuides: () => void; isAdmin: boolean }) {
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
            Design a custom enclosure for your project, get a 3D print of it <br></br>shipped to you!
          </b>
        </p>
        {/* cassos badge removed from public Hero */}
      

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
            <div className="buttons-row bottom">
              <button
                className="btn secondary"
                type="button"
                onClick={onOpenGuides}
              >
                <ActionLabel icon={<PencilIcon />} text="Design Guides" />
              </button>
              {isAdmin ? (
                <a href="/weekly-challenges">
                  <button className="btn secondary" type="button">
                    <ActionLabel icon={<TrophyIcon />} text="Weekly Challenges" />
                  </button>
                </a>
              ) : null}
              {/* Shop is hidden from public UI per config. */}
              <a
                target="_blank"
                rel="noreferrer"
                href="https://slack.hackclub.com/join"
              >
                <button className="btn secondary" type="button">
                  <ActionLabel icon={<ChatIcon />} text="Join Slack" />
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
        <h2>How Enclosure Works?</h2>
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
        <h2>How to Participate</h2>

        <div className="card no-tilt" style={{ padding: '22px 26px' }}>
          <p style={{ marginBottom: 8 }}>
            We keep the process simple, so all you need to do is design and submit. Follow the steps below to put together a strong submission!
          </p>

          <ol style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Design carefully:</strong> Build your model in Fusion 360 or Onshape. For structural parts, use wall thickness of at least 2 mm. Leave about 0.5 to 1.0 mm of clearance for buttons and ports, and account for assembly tolerances.
            </li>
            <li>
              <strong>Export high-quality files:</strong> Use STP or STEP when possible. If you submit an STL, make sure it is manifold, scaled correctly, and exported at high enough resolution.
            </li>
            <li>
              <strong>Track hours with Lapse:</strong> To qualify for tier prizes, you need to log your project time in Lapse.
            </li>
            <li>
              <strong>Provide notes:</strong> In the form, include device measurements, mounting points, and any special instructions such as press-fit tolerances, removable lids, or cable channels.
            </li>
            <li>
              <strong>Submit and review:</strong> Send your project through the form. Our team checks printability and may ask for small revisions. After approval, we print, post-process, and ship your enclosure. Most projects arrive in 2 to 4 weeks.
            </li>
          </ol>

          <div style={{ marginTop: 14 }}>
            <a href="https://forms.hackclub.com/enclosure" target="_blank" rel="noreferrer">
              <button className="btn">Submit design</button>
            </a>
            <button className="btn secondary" type="button" style={{ marginLeft: 10 }} onClick={onOpenGuides}>
              View Design Guides
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PrizeTiers() {
  return (
    <section className="section" id="prize-tiers">
      <div className="container">
        <h2>Prize Tiers</h2>
        <div className="section-note">
          Tier eligibility by tracked hours and rewards
        </div>

        <div className="card no-tilt" style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>Tier Placement Rules</h3>
          <p style={{ marginBottom: 6 }}>
            All tiers must include a log showing what each hour of work looked like.
          </p>
          <p style={{ marginBottom: 0 }}>
            You should place your project in the correct tier, but reviewers may reassign the tier if it appears incorrect.
          </p>
        </div>

        <div className="grid" style={{ gap: 22 }}>
          {individualPrizeTiers.map((tier) => (
            <div key={tier.name} className="card no-tilt">
              <h3 style={{ marginTop: 0 }}>{tier.name}</h3>
              <p style={{ marginBottom: 6 }}><strong>Hours:</strong> {tier.hours}</p>
              <p style={{ marginBottom: 8 }}><strong>Reward:</strong> {tier.reward}</p>
              <p style={{ marginBottom: 6 }}><strong>Requirements:</strong></p>
              <ul className="tier-detail-list">
                {tier.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          ))}

          <div className="card no-tilt" style={{ borderStyle: "solid" }}>
            <h3 style={{ marginTop: 0 }}>{clubPrizeTier.name}</h3>
            <p style={{ marginBottom: 6 }}><strong>Hours:</strong> {clubPrizeTier.hours}</p>
            <p><strong>Reward:</strong> {clubPrizeTier.reward}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function GrantUsage() {
  return (
    <section className="section" id="grant-usage">
      <div className="container">
        <h2>Grant Usage</h2>
        <div className="section-note">What grant cards can and cannot be used for</div>

        <div className="grid" style={{ gap: 22 }}>
          <div className="card no-tilt">
            <h3 style={{ marginTop: 0 }}>Allowed Purchases</h3>
            <ul className="tier-detail-list">
              <li>3D printing materials (filament, nozzles, beds, adhesives)</li>
              <li>CAD and build tools (calipers, hand tools, repair kits)</li>
              <li>Electronics and prototyping parts (sensors, wires, components)</li>
              <li>Workshop supplies related to your enclosure project</li>
            </ul>
          </div>

          <div className="card no-tilt" style={{ borderStyle: "solid" }}>
            <h3 style={{ marginTop: 0 }}>Not Covered</h3>
            <ul className="tier-detail-list">
              <li>Unrelated personal purchases</li>
              <li>Cash withdrawals or cash-equivalent transfers</li>
              <li>Items not connected to your submitted project work</li>
            </ul>
            <p style={{ marginTop: 10, color: "#ffb4b4" }}>
              Warning: Using grant funds for non-covered purchases can result in a Hack Club ban and loss of eligibility for future Hack Club events.
            </p>
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
        { label: "iFixit Anti-Static Wrist Strap", note: "about 1h", img: "https://placehold.co/200x140?text=Anti-Static+Strap" },
        { label: "Bambu Lab PLA Basic Filament 1kg", note: "about 5h", img: "https://placehold.co/200x140?text=PLA+Basic+1kg" },
        { label: "iFixit Moray Driver Kit", note: "about 5h", img: "https://placehold.co/200x140?text=Moray+Driver+Kit" },
        { label: "ENGINEER SS-02 Solder Sucker", note: "about 5.5h", img: "https://placehold.co/200x140?text=Engineer+SS-02" },
      ],
    },
    {
      title: "Tier 2 - Advanced Rewards",
      direction: "reverse" as const,
      items: [
        { label: "Pinecil V2 Smart Soldering Iron", note: "about 10h", img: "https://placehold.co/200x140?text=Pinecil+V2" },
        { label: "Raspberry Pi Zero 2 W Starter Kit", note: "about 11.25h", img: "https://placehold.co/200x140?text=Pi+Zero+2+W+Kit" },
        { label: "YubiKey 5 NFC", note: "about 12.5h", img: "https://placehold.co/200x140?text=YubiKey+5+NFC" },
        { label: "iFixit Pro Tech Toolkit", note: "about 18.75h", img: "https://placehold.co/200x140?text=Pro+Tech+Toolkit" },
        { label: "TS101 USB-C Soldering Iron Kit", note: "about 22.5h", img: "https://placehold.co/200x140?text=TS101+Kit" },
        { label: "Logitech MX Master 3S", note: "about 25h", img: "https://placehold.co/200x140?text=MX+Master+3S" },
        { label: "Hakko FX-888DX Soldering Station", note: "about 30h", img: "https://placehold.co/200x140?text=Hakko+FX-888DX" },
        { label: "Raspberry Pi 5 8GB", note: "about 31.25h", img: "https://placehold.co/200x140?text=Raspberry+Pi+5+8GB" },
        { label: "Raspberry Pi 500", note: "about 32.5h", img: "https://placehold.co/200x140?text=Raspberry+Pi+500" },
        { label: "Flipper Zero", note: "about 49.75h", img: "https://placehold.co/200x140?text=Flipper+Zero" },
        { label: "Sony WH-1000XM4", note: "about 50h", img: "https://placehold.co/200x140?text=WH-1000XM4" },
      ],
    },
    {
      title: "Tier 1 - Best Rewards",
      direction: "normal" as const,
      items: [
        { label: "Creality Ender-3 V3 KE", note: "about 70h", img: "https://placehold.co/200x140?text=Ender-3+V3+KE" },
        { label: "Bambu Lab AMS lite", note: "about 70h", img: "https://placehold.co/200x140?text=Bambu+AMS+lite" },
        { label: "Bambu Lab A1 mini", note: "about 75h", img: "https://placehold.co/200x140?text=Bambu+A1+mini" },
        { label: "Anycubic Kobra 2 Pro", note: "about 75h", img: "https://placehold.co/200x140?text=Kobra+2+Pro" },
        { label: "ELEGOO Neptune 4 Pro", note: "about 75h", img: "https://placehold.co/200x140?text=Neptune+4+Pro" },
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
                          if (img.dataset.fallback === "2") return;
                          if (img.dataset.fallback !== "1") {
                            img.dataset.fallback = "1";
                            const legacy = legacyShopImagePathFromTitle(item.label);
                            if (legacy) {
                              img.src = legacy;
                              return;
                            }
                          }
                          img.dataset.fallback = "2";
                          img.src = item.img || PLACEHOLDER_COVER;
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
      {/* View full shop removed from public index */}
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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/profile`, { credentials: "include" });
        if (res.status === 401) {
          // In local Vite dev, allow browsing without forcing identity login.
          if (import.meta.env.DEV) return;
          // Not authenticated: redirect the browser to the identity provider.
          const cont = window.location.origin;
          window.location.href = `${API_BASE}/api/auth/login?continue=${encodeURIComponent(cont)}&force=1`;
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data?.name) setDisplayName(data.name);
        if (data?.canManageShop || data?.role === "admin") setIsAdmin(true);
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
        {/* cassos counter removed from header */}
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
      <Hero onOpenGuides={() => setShowDesignGuideModal(true)} isAdmin={isAdmin} />
      <HowItWorks />
      <Paths onOpenGuides={() => setShowDesignGuideModal(true)} />
      <PrizeTiers />
      <GrantUsage />
      {false && <Gallery />}
      {/* Shop component removed from public index. */}
      <Requirements />
      <FAQ />
      <Footer />
    </>
  );
}
