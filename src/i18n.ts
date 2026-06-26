import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "en" | "ru";

type Dict = Record<string, string>;

const en: Dict = {
  "app.name": "Seating",
  "common.open": "Import",
  "common.save": "Export",
  "common.reset": "Reset",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.undo": "Undo",
  "common.redo": "Redo",
  "project.untitled": "Untitled project",
  "common.add": "Add",
  "common.delete": "Delete",
  "common.duplicate": "Duplicate",
  "common.theme.light": "Light",
  "common.theme.dark": "Dark",
  "common.confirmReset": "Clear project? Unsaved data will be lost.",
  "common.importError": "Could not open file: ",

  "left.addTable": "Add table",
  "left.hall": "Hall",
  "left.width": "Width, m",
  "left.length": "Length, m",
  "left.gridStep": "Grid step, m",
  "left.snapToGrid": "Snap to grid",
  "left.parameters": "Parameters",
  "left.defaultChair": "Default chair",
  "left.minSpacing": "Min. width per guest, m",
  "left.apply": "Apply size",
  "left.tablesDontFit": "Tables {n} don't fit the new size",

  "size.small": "Small",
  "size.medium": "Medium",
  "size.large": "Large",

  "shape.round": "Round",
  "shape.rect": "Rectangular",
  "shape.ellipse": "Ellipse / circle",
  "shape.emperor": "Emperor",
  "shape.snake": "Snake (serpentine)",

  "chair.round": "Round",
  "chair.square": "Square",
  "chair.inherit": "As project",

  "table.word": "Table",
  "table.noSelection": "No table selected.",
  "table.noSelectionHint": "Add a table on the left and click it on the canvas to edit its properties.",
  "table.name": "Name",
  "table.shape": "Shape",
  "table.axisX": "Axis X, m",
  "table.axisY": "Axis Y, m",
  "table.rotation": "Rotation, °",
  "table.seats": "Seats",
  "table.seatStep": "Seat step",
  "table.comfortUpTo": "comfortable up to",
  "table.tight": "tight!",
  "table.chair": "Chair",
  "table.activeSides": "Active sides",
  "table.podium": "Podium (raised above the floor)",
  "table.seatsShort": "seats",
  "table.selected": "Selected",
  "table.mixed": "—",
  "table.bulkHint": "Fields with differing values are locked.",
  "table.listTitle": "Tables",
  "table.listEmpty": "No tables yet.",
  "table.lock": "Lock",
  "table.unlock": "Unlock",

  "side.top": "Top",
  "side.right": "Right",
  "side.bottom": "Bottom",
  "side.left": "Left",

  "modal.title": "Add table",
  "modal.templates": "Templates",
  "modal.custom": "Table settings",
  "modal.quantity": "Quantity",

  "obj.section": "Interior elements",
  "obj.add": "Add interior element",
  "obj.object": "Interior element",
  "elements.title": "Elements",
  "elements.empty": "Nothing on the plan yet.",
  "common.selectAll": "Select all",
  "obj.type": "Type",
  "obj.label": "Label",
  "obj.stage": "Stage",
  "obj.screen": "Screen",
  "obj.stageScreen": "Stage + screen",
  "obj.dancefloor": "Dance floor",
  "obj.bar": "Bar",
  "obj.entrance": "Door",
  "obj.giftTable": "Gift table",
  "obj.columnRound": "Round column",
  "obj.columnSquare": "Square column",
  "obj.lock": "Lock",
  "obj.unlock": "Unlock",
  "obj.locked": "Locked",
  "obj.listTitle": "Objects on the plan",
  "obj.listEmpty": "No objects yet.",

  "zoom.in": "Zoom in",
  "zoom.out": "Zoom out",
  "zoom.fit": "Fit",

  "unit.m": "m",
  "lang.label": "Language",

  "help.title": "Keyboard shortcuts",
  "help.deselect": "Deselect / close dialog",
  "help.selectAll": "Select all tables / deselect",
  "help.copyPaste": "Copy / paste (at cursor)",
  "help.duplicate": "Duplicate",
  "help.export": "Export project",
  "help.delete": "Delete selection",
  "help.move": "Move (Shift = larger step)",
  "help.rotate": "Rotate ±15° (Shift = ±90°)",
  "help.lock": "Lock / unlock selection",
  "help.zoom": "Zoom; 0 = fit to screen",
  "help.pan": "Pan the canvas",
};

const ru: Dict = {
  "app.name": "Рассадка",
  "common.open": "Импорт",
  "common.save": "Экспорт",
  "common.reset": "Сброс",
  "common.cancel": "Отмена",
  "common.close": "Закрыть",
  "common.undo": "Отменить",
  "common.redo": "Повторить",
  "project.untitled": "Новый проект",
  "common.add": "Добавить",
  "common.delete": "Удалить",
  "common.duplicate": "Дублировать",
  "common.theme.light": "Светлая",
  "common.theme.dark": "Тёмная",
  "common.confirmReset": "Очистить проект? Несохранённые данные пропадут.",
  "common.importError": "Не удалось открыть файл: ",

  "left.addTable": "Добавить стол",
  "left.hall": "Зал",
  "left.width": "Ширина, м",
  "left.length": "Длина, м",
  "left.gridStep": "Шаг сетки, м",
  "left.snapToGrid": "Привязка к сетке",
  "left.parameters": "Параметры",
  "left.defaultChair": "Стул по умолчанию",
  "left.minSpacing": "Мин. место на гостя, м",
  "left.apply": "Применить размер",
  "left.tablesDontFit": "Столы {n} не помещаются в новый размер",

  "size.small": "Маленький",
  "size.medium": "Средний",
  "size.large": "Большой",

  "shape.round": "Круглый",
  "shape.rect": "Прямоугольный",
  "shape.ellipse": "Эллипс / круг",
  "shape.emperor": "Императорский",
  "shape.snake": "Стол-змейка",

  "chair.round": "Круглый",
  "chair.square": "Квадратный",
  "chair.inherit": "Как в проекте",

  "table.word": "Стол",
  "table.noSelection": "Стол не выбран.",
  "table.noSelectionHint": "Добавьте стол слева и кликните по нему на холсте, чтобы изменить свойства.",
  "table.name": "Название",
  "table.shape": "Форма",
  "table.axisX": "Ось X, м",
  "table.axisY": "Ось Y, м",
  "table.rotation": "Поворот, °",
  "table.seats": "Места",
  "table.seatStep": "Шаг места",
  "table.comfortUpTo": "комфортно до",
  "table.tight": "тесно!",
  "table.chair": "Стул",
  "table.activeSides": "Активные стороны",
  "table.podium": "Подиум (выше уровня пола)",
  "table.seatsShort": "мест",
  "table.selected": "Выбрано",
  "table.mixed": "—",
  "table.bulkHint": "Поля с разными значениями заблокированы.",
  "table.listTitle": "Столы",
  "table.listEmpty": "Столов пока нет.",
  "table.lock": "Заблокировать",
  "table.unlock": "Разблокировать",

  "side.top": "Верх",
  "side.right": "Право",
  "side.bottom": "Низ",
  "side.left": "Лево",

  "modal.title": "Добавить стол",
  "modal.templates": "Шаблоны",
  "modal.custom": "Настройки стола",
  "modal.quantity": "Количество",

  "obj.section": "Элементы интерьера",
  "obj.add": "Добавить элемент интерьера",
  "obj.object": "Элемент интерьера",
  "elements.title": "Элементы",
  "elements.empty": "На плане пока пусто.",
  "common.selectAll": "Выбрать все",
  "obj.type": "Тип",
  "obj.label": "Подпись",
  "obj.stage": "Сцена",
  "obj.screen": "Экран",
  "obj.stageScreen": "Сцена с экраном",
  "obj.dancefloor": "Танцпол",
  "obj.bar": "Бар",
  "obj.entrance": "Дверь",
  "obj.giftTable": "Стол подарков",
  "obj.columnRound": "Колонна круглая",
  "obj.columnSquare": "Колонна квадратная",
  "obj.lock": "Заблокировать",
  "obj.unlock": "Разблокировать",
  "obj.locked": "Заблокирован",
  "obj.listTitle": "Объекты на плане",
  "obj.listEmpty": "Объектов пока нет.",

  "zoom.in": "Приблизить",
  "zoom.out": "Отдалить",
  "zoom.fit": "Вписать",

  "unit.m": "м",
  "lang.label": "Язык",

  "help.title": "Горячие клавиши",
  "help.deselect": "Снять выделение / закрыть окно",
  "help.selectAll": "Выделить все столы / снять выделение",
  "help.copyPaste": "Копировать / вставить (по курсору)",
  "help.duplicate": "Дублировать",
  "help.export": "Экспорт проекта",
  "help.delete": "Удалить выбранное",
  "help.move": "Переместить (Shift — крупный шаг)",
  "help.rotate": "Поворот ±15° (Shift — ±90°)",
  "help.lock": "Заблокировать / разблокировать",
  "help.zoom": "Зум; 0 — вписать в экран",
  "help.pan": "Панорамирование холста",
};

const messages: Record<Lang, Dict> = { en, ru };

function detectLang(): Lang {
  if (typeof navigator !== "undefined") {
    const sys = (navigator.language || "").toLowerCase();
    if (sys.startsWith("ru")) return "ru";
  }
  return "en";
}

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      lang: detectLang(),
      setLang: (lang) => set({ lang }),
    }),
    { name: "seating-planner:lang" },
  ),
);

export function translate(lang: Lang, key: string): string {
  return messages[lang][key] ?? messages.en[key] ?? key;
}

/** Hook returning a translate function bound to the current language. */
export function useT() {
  const lang = useI18n((s) => s.lang);
  return (key: string) => translate(lang, key);
}
