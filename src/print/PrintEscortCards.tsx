import type { PrintContext } from "./context";

/** Print view: a grid of "name → table" escort cards, alphabetical. */
export function PrintEscortCards({ ctx }: { ctx: PrintContext }) {
  const seated = ctx.guests.filter((g) => g.seat).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="print-cards">
      {seated.map((g, i) => (
        <div key={i} className="print-card">
          <span className="print-card-name">{g.name}</span>
          <span className="print-card-table">
            {g.seat ? (ctx.tableLabel.get(g.seat.tableId) ?? "") : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
