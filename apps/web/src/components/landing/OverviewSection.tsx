import { FEATURES } from "./constants";

export function OverviewSection() {
  return (
    <section id="overview" className="overview-section container" aria-label="Platform capabilities">
      <div className="overview-header">
        <p className="edge-kicker">OVERVIEW</p>
        <h2>One control plane for the complete autonomous wallet lifecycle.</h2>
      </div>
      <div className="minimal-strip">
        {FEATURES.map((feature, index) => (
          <article key={feature.title} className={`minimal-pill minimal-pill-bento minimal-pill-${index + 1}`}>
            <div className="minimal-pill-icon">{feature.icon}</div>
            <div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
