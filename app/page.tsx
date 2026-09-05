import Image from "next/image"
import Link from "next/link"

import { getPropertyImageLabel, getPropertyImagePath } from "@/lib/auth"
import { hasCosmosConfiguration } from "@/lib/server/cosmos"
import { listPublicAvailableProperties } from "@/lib/server/properties"

const steps = [
  ["01", "See what is verified", "Every listing shows its evidence, costs, and current status before you enquire."],
  ["02", "Apply with clarity", "Know the timeline, documents, and decision criteria at every stage."],
  ["03", "Move forward together", "A secure workspace keeps tenants, landlords, and support in sync."],
]

const trustFeatures = [
  ["01", "Property Trust", "Clear listing status, approved images, compliance records, and costs in one view."],
  ["02", "Authenticity checks", "Registration signals are assessed before a permanent account can exist."],
  ["03", "A visible paper trail", "Applications, payments, messages, and decisions stay easy to find."],
]

function formatCurrency(value: number) {
  return `£${value.toLocaleString("en-GB")} pcm`
}

export default async function HomePage() {
  const properties = hasCosmosConfiguration() ? await listPublicAvailableProperties("") : []
  const featuredProperty = [...properties].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]
  const featuredImage = featuredProperty?.images.find((image) => image.moderationStatus === "approved" && image.isCoverImage)
    ?? featuredProperty?.images.find((image) => image.moderationStatus === "approved")

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-grid" />
        <div className="landing-container relative z-10">
          <div className="landing-hero-copy">
            <p className="landing-kicker">The transparent rental platform</p>
            <h1>Rent with Confidence.<br /><em>Let with Confidence.</em></h1>
            <p className="landing-lede">A clearer way to rent and let. Verified homes, visible decisions, and human support when the process needs a person.</p>
            <div className="landing-actions">
              <Link href="/properties" className="landing-button landing-button-primary">Find a verified home <span aria-hidden="true">↗</span></Link>
              <Link href="/login?mode=register" className="landing-button landing-button-quiet">List with clarity</Link>
            </div>
            <p className="landing-note"><span className="status-dot" /> No hidden steps. No pressure to commit.</p>
          </div>
          <div className="trust-console" aria-label="RentSimple trust console preview">
            <div className="console-top"><span>RENT SIMPLE / PROPERTY TRUST</span><span className="console-live">LIVE STATUS</span></div>
            <div className="console-title">A rental decision you can understand.</div>
            <div className="console-row"><span>Listing identity</span><strong>Confirmed</strong></div>
            <div className="console-row"><span>Compliance record</span><strong>Up to date</strong></div>
            <div className="console-row"><span>Costs before commitment</span><strong>Shown in full</strong></div>
            <div className="console-footer"><span>Trust is a process, not a badge.</span><span aria-hidden="true">→</span></div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Trust indicators">
        <div className="landing-container trust-strip-inner">
          <span><b>✓</b> Verified information</span><span><b>◷</b> Clear timelines</span><span><b>⌁</b> Secure records</span><span><b>○</b> Human support</span>
        </div>
      </section>

      <section className="landing-section landing-section-light">
        <div className="landing-container split-heading"><div><p className="landing-kicker">A better starting point</p><h2>Trust before search.<br /><span>Clarity before commitment.</span></h2></div><p className="section-intro">RentSimple brings the details people usually have to chase into one calm, shared place. Less guesswork for tenants. Less admin for landlords.</p></div>
        <div className="landing-container step-grid">{steps.map(([number, title, copy]) => <article className="step-item" key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="landing-section landing-section-ink">
        <div className="landing-container"><div className="section-heading-inverse"><p className="landing-kicker">01 / Property Trust</p><h2>See the home.<br /><span>Understand the context.</span></h2><p>Listings should answer the important questions before they ask for your details.</p></div>
          <div className="property-showcase">
            {featuredProperty && featuredImage ? <Image src={getPropertyImagePath(featuredProperty.id, featuredImage.id, "thumbnail")} alt={getPropertyImageLabel(featuredImage)} fill className="property-showcase-image" unoptimized /> : <div className="property-illustration"><div className="illustration-window" /><div className="illustration-door" /><div className="illustration-sun" /></div>}
            <div className="property-overlay"><span className="verified-label">✓ Verified listing</span><span>Evidence-led property details</span></div>
          </div>
          {featuredProperty ? <div className="property-caption"><div><p className="landing-kicker">Available now</p><h3>{featuredProperty.address}</h3><p>{featuredProperty.city} · {featuredProperty.bedrooms} bed · {featuredProperty.bathrooms} bath</p></div><strong>{formatCurrency(featuredProperty.monthlyRent)}</strong><Link href={`/properties/${featuredProperty.id}`} aria-label={`View ${featuredProperty.address}`}>View home ↗</Link></div> : <div className="property-caption"><div><p className="landing-kicker">Designed for confidence</p><h3>Every detail has a place.</h3><p>Costs, records, images, and status stay together.</p></div><Link href="/properties">Browse homes ↗</Link></div>}
        </div>
      </section>

      <section className="landing-section landing-section-paper"><div className="landing-container feature-grid">{trustFeatures.map(([number, title, copy]) => <article className="feature-item" key={number}><span className="feature-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="landing-section landing-section-accent"><div className="landing-container security-layout"><div><p className="landing-kicker">02 / Registration authenticity</p><h2>Good systems know when to slow down.</h2><p>RentSimple checks authenticity signals before a permanent account is created. It helps keep fake, automated, and disposable registrations away from the people doing the real work.</p><Link href="/login?mode=register" className="text-link">Create an account safely ↗</Link></div><div className="signal-card"><div className="signal-card-top"><span>AUTHENTICITY GATEWAY</span><span className="signal-lock">LOCKED</span></div><div className="signal-line"><span>Email confidence</span><i><b style={{ width: "92%" }} /></i><strong>92</strong></div><div className="signal-line"><span>Device confidence</span><i><b style={{ width: "87%" }} /></i><strong>87</strong></div><div className="signal-line"><span>Decision trail</span><strong className="signal-ok">READY ✓</strong></div></div></div></section>

      <section className="landing-section landing-section-light"><div className="landing-container transparency-layout"><div className="transparency-index">03<br /><span>Application transparency</span></div><div><p className="landing-kicker">No more black boxes</p><h2>Know where you stand.</h2><p>From first enquiry to final decision, you can see what is happening, what is needed, and who owns the next step. A calm process is a fairer process.</p><div className="timeline"><span className="timeline-active">Enquiry</span><span>Documents</span><span>Review</span><span>Decision</span></div></div></div></section>

      <section className="landing-section landing-section-paper"><div className="landing-container payment-layout"><div><p className="landing-kicker">04 / Payment transparency</p><h2>See every pound<br /><span>before it moves.</span></h2></div><div><p>RentSimple makes the numbers legible: rent, deposits, dates, records, and communication live in the same tenant and landlord workspace.</p><div className="payment-list"><span><b>£</b> Charges explained</span><span><b>↗</b> Receipts recorded</span><span><b>◷</b> Dates made visible</span></div></div></div></section>

      <section className="landing-section landing-section-ink support-section"><div className="landing-container support-layout"><div><p className="landing-kicker">05 / Support model</p><h2>Technology for the routine.<br /><span>People for the human bits.</span></h2></div><div><p>Self-serve when it is simple. Clear routes to support when it is not. RentSimple is designed to reduce chasing, not hide behind automation.</p><Link href="/waiting" className="text-link text-link-light">See how support works ↗</Link></div></div></section>

      <section className="landing-section metrics-section"><div className="landing-container metrics-grid"><div><strong>100%</strong><span>of key decisions<br />kept visible</span></div><div><strong>1</strong><span>shared place<br />for the journey</span></div><div><strong>24/7</strong><span>access to your<br />rental records</span></div></div></section>

      <section className="landing-final"><div className="landing-container final-inner"><p className="landing-kicker">A simpler standard for renting</p><h2>Confidence is<br /><em>the feature.</em></h2><p>Start with the route that fits you.</p><div className="landing-actions"><Link href="/properties" className="landing-button landing-button-primary">I am looking for a home <span aria-hidden="true">↗</span></Link><Link href="/login?mode=register" className="landing-button landing-button-secondary">I am letting a property</Link><Link href="/login" className="landing-button landing-button-text">Existing customer →</Link></div></div></section>
    </div>
  )
}
