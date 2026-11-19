import CategoriesPanel from "@/components/CategoriesPanel";
import PageHeader from "@/components/PageHeader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * Ruta `/categories` conservada como acceso directo y enlazable. La gestión de
 * categorías vive en `CategoriesPanel`, compartida con la pestaña de Productos.
 */
export default function CategoriesPage() {
  useDocumentTitle("Categorías");

  return (
    <div>
      <PageHeader
        title="Categorías"
        description="Organiza los productos del catálogo por categorías."
      />
      <CategoriesPanel />
    </div>
  );
}
