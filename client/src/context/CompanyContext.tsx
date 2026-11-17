import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_COMPANY } from "@/config/company";
import { getCompany } from "@/services/companyService";
import type { CompanySettings } from "@/types";

interface CompanyContextValue {
  company: CompanySettings;
  loading: boolean;
  /** Vuelve a leer los datos del emisor (tras guardar en «Empresa»). */
  reload: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue>({
  company: DEFAULT_COMPANY,
  loading: false,
  reload: async () => {},
});

/**
 * Carga una sola vez los datos de la empresa emisora y los comparte con las
 * cabeceras de impresión. Si la consulta falla se mantienen los valores por
 * defecto: imprimir nunca debe romperse por un problema de red.
 */
export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setCompany(await getCompany());
    } catch {
      setCompany(DEFAULT_COMPANY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(() => ({ company, loading, reload }), [company, loading, reload]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export const useCompany = () => useContext(CompanyContext);
