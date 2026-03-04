import { EDGE_ITEMS } from "./constants";

export function EdgeSection() {
  return (
    <section className="edge-section container" aria-label="Hackathon differentiation">
      <div className="edge-header">
        <p className="edge-kicker">WHY AUTARCH DISTRICT</p>
        <h2>Built for real autonomous wallet operations, not a static demo.</h2>
      </div>
      <div className="edge-grid">
        {EDGE_ITEMS.map((item, index) => (
          <article key={item.title} className={`edge-card edge-card-bento edge-card-${index + 1}`}>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
