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

  "side.top": "Top",
  "side.right": "Right",
  "side.bottom": "Bottom",
  "side.left": "Left",

  "modal.title": "Add table",
  "modal.templates": "Templates",
  "modal.custom": "Table settings",
  "modal.quantity": "Quantity",

  "zoom.in": "Zoom in",
  "zoom.out": "Zoom out",
  "zoom.fit": "Fit",

  "unit.m": "m",
  "lang.label": "Language",
};

const ru: Dict = {
  "app.name": "Рассадка",
  "common.open": "Импорт",
  "common.save": "Экспорт",
  "common.reset": "Сброс",
  "common.cancel": "Отмена",
  "common.close": "Закрыть",
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

  "side.top": "Верх",
  "side.right": "Право",
  "side.bottom": "Низ",
  "side.left": "Лево",

  "modal.title": "Добавить стол",
  "modal.templates": "Шаблоны",
  "modal.custom": "Настройки стола",
  "modal.quantity": "Количество",

  "zoom.in": "Приблизить",
  "zoom.out": "Отдалить",
  "zoom.fit": "Вписать",

  "unit.m": "м",
  "lang.label": "Язык",
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
