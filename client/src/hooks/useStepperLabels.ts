import { useEffect, type RefObject } from "react";

/**
 * AntD 6 etiqueta las flechas de `InputNumber` en inglés dentro del propio
 * componente, sin exponer una prop ni un valor de locale para cambiarlas.
 * Este hook las traduce en el árbol indicado, incluidas las filas que se
 * agregan después (atajos, pegado y clonado).
 */
export function useStepperLabels(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const apply = (node: Element) => {
      if (!(node instanceof HTMLElement) || !node.classList.contains("ant-input-number-action")) return;
      const action = node.classList.contains("ant-input-number-action-up")
        ? "Aumentar"
        : node.classList.contains("ant-input-number-action-down")
          ? "Disminuir"
          : null;
      if (!action) return;
      const label = node.closest(".ant-form-item")?.querySelector(".ant-form-item-label")?.textContent?.trim();
      node.setAttribute("aria-label", `${action} ${label || "valor"}`);
    };

    const applyTree = (node: Element) => {
      if (node.classList?.contains("ant-input-number-action")) apply(node);
      node.querySelectorAll?.(".ant-input-number-action").forEach(apply);
    };

    applyTree(root);
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) applyTree(node);
        });
      });
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [rootRef]);
}
