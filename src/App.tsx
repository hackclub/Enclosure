import { useMemo, useState } from "react";

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

const faqItems = [
  {
    key: "design",
    question: "What exactly do I design?",
    answer: (
      <p>
        You design a <b>phone or tablet enclosure</b> — basically a case or
        cover. It can be protective, decorative, weird, chunky, minimal, or
        cursed. As long as it is an enclosure and printable, you are good.
      </p>
    ),
  },
  {
    key: "devices",
    question: "Which devices are allowed?",
    answer: (
      <p>
        Most phones and tablets are allowed. If your device is extremely huge or
        oddly shaped, we may ask you to tweak the design.
      </p>
    ),
  },
  {
    key: "printer",
    question: "Do I need a 3D printer?",
    answer: <p>Nope. You design it — we print it — we ship it to you.</p>,
  },
  {
    key: "hackatime",
    question: "Is Hackatime required?",
    answer: <p>No, Hackatime is not compulsory, although it is recommended.</p>,
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

const steps = [
  {
    title: "1. Measure 📏",
    body: "Measure your phone or tablet carefully. Button cutouts, camera bumps, ports — all that good stuff.",
    tag: "accuracy matters",
  },
  {
    title: "2. Design 🧠",
    body: "Design your enclosure in Fusion or Onshape. Add grip, texture, logos, chaos.",
    tag: "CAD time",
  },
  {
    title: "3. Submit ⬆️",
    body: "Upload your CAD file through the submission form. We will sanity-check it before printing.",
    tag: "STP / STEP",
  },
  {
    title: "4. Ship 📦",
    body: "We 3D print your enclosure and ship it straight to you. Yes, for real.",
    tag: "free plastic",
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
    icon: "🧱",
    title: "No supports needed",
    body: "Design so it prints cleanly without extra supports. Think about overhangs.",
    tag: "print-friendly",
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
    body: "Anyone can participate who is 13-18 years old.",
    tag: "play nice",
  },
];

function Hero() {
  return (
    <section className="hero">
      <div className="hero-inner">
        <a target="_blank" rel="noreferrer" href="https://cad.hackclub.com">
          <div className="ysws-badge">Hack Club · CAD YSWS</div>
        </a>
        <div className="hero-visual">
          <img
            className="hero-logo"
            src="assets/logo.png"
            alt="Enclosure logo"
          />
          <div className="covers-wrap">
            <img
              className="cover-img cover-1"
              src="assets/covers/Case.png"
              alt="Enclosure cover example 1"
            />
            <img
              className="cover-img cover-2"
              src="assets/covers/case1.png"
              alt="Enclosure cover example 2"
            />
            <img
              className="cover-img cover-3"
              src="assets/covers/Case2png.png"
              alt="Enclosure cover example 3"
            />
            <img
              className="cover-img cover-4"
              src="assets/covers/Case3-.png"
              alt="Enclosure cover example 4"
            />
          </div>
        </div>
        <p>
          <b>
            Design your cover, we 3D-print and ship it! Make it protective,
            weird, minimal, chunky, or cursed.
          </b>
        </p>
        <div className="sub">
          You design it → we 3D print it → we ship it to you.
        </div>

        <div className="buttons-wrap">
          <div className="buttons">
            <div className="buttons-row top">
              <a href="https://forms.hackclub.com/enclosure" target="_blank">
              <button
                className="btn"
                type="button"
              >
                Submit your project →
              </button>
              </a>
            </div>
            <div className="buttons-row bottom">
              <a
                target="_blank"
                rel="noreferrer"
                href="https://docs.google.com/presentation/d/e/2PACX-1vQpmTW_T9md56kegOqOYb9zAVv_upZSIxsNc59ueinncyolm_nHDyLXihWIRhBKb71LDOq6W_snMWBX/pub?start=false&loop=false&delayms=3000"
              >
                <button className="btn secondary" type="button">
                  Design Guide ✏️
                </button>
              </a>
              <a target="_blank"href="https://hackclub.enterprise.slack.com/archives/C092D99G1RU">
                <button className="btn secondary" type="button">
                  Join Slack🛠️
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
          aka: how plastic ends up at your door
        </div>
        <div className="grid">
          {steps.map((step) => (
            <div key={step.title} className="card">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              <span className="tag">{step.tag}</span>
            </div>
          ))}
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
        <div className="section-note">expect questionable design choices</div>
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
      title: "0–19 hour picks",
      direction: "normal" as const,
      items: [
        { label: "Sticker pack", note: "fresh vinyl", img: "https://placehold.co/200x140?text=Stickers" },
        { label: "Keycaps", note: "HC set", img: "https://placehold.co/200x140?text=Keycaps" },
        { label: "3D print credit", note: "$10", img: "https://placehold.co/200x140?text=3D+Print" },
        { label: "Zombo domain", note: "1yr", img: "https://placehold.co/200x140?text=Domain" },
        { label: "Hot chocolate", note: "treat", img: "https://placehold.co/200x140?text=Treat" },
        { label: "HackDucky", note: "fun", img: "https://placehold.co/200x140?text=Ducky" },
        { label: "Smolāj", note: "squish", img: "https://placehold.co/200x140?text=Plush" },
        { label: "Pinecil", note: "solder", img: "https://placehold.co/200x140?text=Iron" },
        { label: "Notebook", note: "grid", img: "https://placehold.co/200x140?text=Notebook" },
      ],
    },
    {
      title: "20–99 hour prizes",
      direction: "reverse" as const,
      items: [
        { label: "Raspberry Pi 5", note: "48h", img: "https://placehold.co/200x140?text=Pi+5" },
        { label: "2TB SSD", note: "storage", img: "https://placehold.co/200x140?text=SSD" },
        { label: "Open Source tix", note: "2026", img: "https://placehold.co/200x140?text=Tickets" },
        { label: "Raspberry Pi 500", note: "desktop", img: "https://placehold.co/200x140?text=Pi+500" },
        { label: "Magic Keyboard", note: "wireless", img: "https://placehold.co/200x140?text=Keyboard" },
        { label: "Flipper Zero", note: "hacks", img: "https://placehold.co/200x140?text=Flipper" },
        { label: "Yubikey", note: "security", img: "https://placehold.co/200x140?text=YubiKey" },
        { label: "CMF Buds", note: "audio", img: "https://placehold.co/200x140?text=Earbuds" },
      ],
    },
    {
      title: "100+ hour prizes",
      direction: "normal" as const,
      items: [
        { label: "Bambu Lab A1 mini", note: "printer", img: "https://placehold.co/200x140?text=Printer" },
        { label: "Pebble Time 2", note: "classic", img: "https://placehold.co/200x140?text=Watch" },
        { label: "Proxmark 3", note: "RFID", img: "https://placehold.co/200x140?text=RFID" },
        { label: "Quest 3", note: "VR", img: "https://placehold.co/200x140?text=VR" },
        { label: "Mac Mini", note: "desktop", img: "https://placehold.co/200x140?text=Mac+Mini" },
        { label: "Nothing headphones", note: "ANC", img: "https://placehold.co/200x140?text=Headphones" },
        { label: "AMS Lite", note: "robot", img: "https://placehold.co/200x140?text=Robot" },
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
          .shop-img { width: 100%; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; border: 2px solid var(--border); background: #1c120d; }
          .shop-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
          @keyframes shop-scroll { from { transform: translateX(0); } to { transform: translateX(calc(-1 * var(--scroll-distance, 50%))); } }
        `}</style>
        {tiers.map((tier, idx) => {
          const repeats = 2;
          const rowItems = Array.from({ length: repeats }, () => tier.items).flat();
          const scrollDistance = 100 / repeats;
          return (
            <div key={tier.title} className={`shop-rail ${tier.direction === "reverse" ? "reverse" : ""}`}>
              <h4>{tier.title}</h4>
              <div
                className="shop-track"
                style={{
                  animationDuration: `${14 + idx * 3}s`,
                  // @ts-expect-error custom property
                  "--scroll-distance": `${scrollDistance}%`
                }}
              >
                {rowItems.map((item, i) => (
                  <div key={`${item.label}-${i}`} className="shop-card">
                    <div className="shop-img" aria-hidden>
                      <img src={item.img} alt="" />
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
            window.location.href = "/shop.html";
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
        <h2>FAQS</h2>
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
      Enclosure is a Hack Club YSWS • made with plastic, patience, and poor life
      choices
    </footer>
  );
}

export default function App() {
  return (
    <>
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
      <Hero />
      <HowItWorks />
      <Shop />
      <Gallery />
      <Requirements />
      <FAQ />
      <Footer />
    </>
  );
}
