import { useStore, activeSheet } from "../../store";
import { useT } from "../../i18n";
import { Icon } from "../Icon";

export function BulkPanel() {
  const t = useT();
  const selectedIds = useStore((s) => s.selectedIds);
  const tables = useStore((s) => activeSheet(s).tables);
  const updateTables = useStore((s) => s.updateTables);
  const updateObjects = useStore((s) => s.updateObjects);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const unweldSelected = useStore((s) => s.unweldSelected);

  const tableSet = new Set(tables.map((tb) => tb.id));
  const tIds = selectedIds.filter((id) => tableSet.has(id));
  const oIds = selectedIds.filter((id) => !tableSet.has(id));

  const anyGrouped = tables.some((tb) => selectedIds.includes(tb.id) && tb.groupId);

  const setLocked = (locked: boolean) => {
    if (tIds.length) updateTables(tIds, { locked });
    if (oIds.length) updateObjects(oIds, { locked });
  };

  return (
    <div className="panel">
      <section className="panel-section">
        <h3>{`${t("table.selected")}: ${selectedIds.length}`}</h3>
        <p className="muted">{t("table.bulkHint")}</p>
      </section>
      {anyGrouped && (
        <section className="panel-section row-actions">
          <button className="btn" onClick={() => unweldSelected()}>
            <Icon name="unweld" /> {t("table.unweld")}
          </button>
        </section>
      )}
      <section className="panel-section actions-col">
        <button className="btn block" onClick={() => duplicateSelected()}>
          <Icon name="duplicate" /> {t("common.duplicate")}
        </button>
        <div className="row-actions">
          <button className="btn icon-only" title={t("obj.lock")} onClick={() => setLocked(true)}>
            <Icon name="lock" />
          </button>
          <button className="btn icon-only" title={t("obj.unlock")} onClick={() => setLocked(false)}>
            <Icon name="unlock" />
          </button>
          <button className="btn danger" onClick={() => deleteSelected()}>
            <Icon name="delete" /> {t("common.delete")}
          </button>
        </div>
      </section>
    </div>
  );
}
