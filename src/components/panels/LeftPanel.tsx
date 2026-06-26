import { useT } from "../../i18n";
import { Icon } from "../Icon";

interface Props {
  onAddTable: () => void;
  onAddObject: () => void;
}

export function LeftPanel({ onAddTable, onAddObject }: Props) {
  const t = useT();
  return (
    <div className="panel">
      <section className="panel-section add-buttons">
        <button className="btn primary block" onClick={onAddTable}>
          <Icon name="add" /> {t("left.addTable")}
        </button>
        <button className="btn block" onClick={onAddObject}>
          <Icon name="add" /> {t("obj.add")}
        </button>
      </section>
    </div>
  );
}
