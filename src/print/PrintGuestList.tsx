import type { PrintContext, PrintGuest } from "./context";

function guestLine(g: PrintGuest): string {
  const extras = [g.roleLabel, ...g.featureLabels].filter(Boolean).join(", ");
  return extras ? `${g.name} — ${extras}` : g.name;
}

/** Print view: guests grouped by table, then an alphabetical index. */
export function PrintGuestList({ ctx }: { ctx: PrintContext }) {
  const t = ctx.t;
  const byTable = new Map<string, PrintGuest[]>();
  for (const g of ctx.guests) {
    if (!g.seat) continue;
    const arr = byTable.get(g.seat.tableId) ?? [];
    arr.push(g);
    byTable.set(g.seat.tableId, arr);
  }
  const unseated = ctx.guests.filter((g) => !g.seat).sort((a, b) => a.name.localeCompare(b.name));
  const alpha = [...ctx.guests].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="print-doc">
      <header className="print-head">
        <h1>{ctx.title}</h1>
        {ctx.subtitle && <p>{ctx.subtitle}</p>}
      </header>

      <h2>{t("export.byTable")}</h2>
      {ctx.halls.map((hall, hi) => (
        <section key={hi}>
          {ctx.multiHall && <h3 className="print-hall">{hall.name}</h3>}
          {hall.tables.map((tb) => {
            const list = (byTable.get(tb.id) ?? []).sort((a, b) => (a.seat?.index ?? 0) - (b.seat?.index ?? 0));
            return (
              <div key={tb.id} className="print-block">
                <h4>
                  {tb.label} <span className="print-count">{list.length}/{tb.seatCount}</span>
                </h4>
                {list.length ? (
                  <ul>
                    {list.map((g, i) => (
                      <li key={i}>{guestLine(g)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="print-empty">— {t("export.empty")}</p>
                )}
              </div>
            );
          })}
        </section>
      ))}

      {unseated.length > 0 && (
        <div className="print-block">
          <h4>
            {t("guests.unseated")} <span className="print-count">{unseated.length}</span>
          </h4>
          <ul>
            {unseated.map((g, i) => (
              <li key={i}>{guestLine(g)}</li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="print-break-before">{t("export.alphabetical")}</h2>
      <table className="print-alpha">
        <tbody>
          {alpha.map((g, i) => (
            <tr key={i}>
              <td>{g.name}</td>
              <td className="print-where">
                {g.seat ? (ctx.tableLabel.get(g.seat.tableId) ?? "") : t("guests.unseated")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
