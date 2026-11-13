/**
 * Корневой HTML-элемент приложения.
 * По умолчанию querySelector возвращает HTMLElement, а для специализированных
 * элементов (input, img, button) вызывающий код задаёт generic-параметр явно.
 */
export type DomRoot = Omit<HTMLElement, 'querySelector' | 'querySelectorAll'> & {
    querySelector<E extends HTMLElement = HTMLElement>(selectors: string): E | null;
    querySelectorAll<E extends HTMLElement = HTMLElement>(selectors: string): NodeListOf<E>;
};
