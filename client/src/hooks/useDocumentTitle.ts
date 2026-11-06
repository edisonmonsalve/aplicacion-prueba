import { useEffect } from "react";

const APP = "Inventario";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP;
  }, [title]);
}
