import { useState } from "react";
import { App, Button, Dropdown } from "antd";
import {
  DownloadOutlined,
  DownOutlined,
  FilePdfOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { getErrorMessage } from "@/utils/errors";
import { openReportWindow } from "@/utils/reportExport";

interface Props {
  disabled?: boolean;
  onCsv: () => void | Promise<void>;
  /** Recibe la ventana ya abierta para no perder el gesto del usuario. */
  onPdf: (target?: Window | null) => void | Promise<void>;
}

/**
 * Botón único de exportación para los reportes: CSV para análisis y PDF
 * (vista imprimible) para compartir o archivar.
 */
export default function ReportExport({ disabled, onCsv, onPdf }: Props) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);

  const run = async (kind: "csv" | "pdf") => {
    setBusy(kind);
    let target: Window | null = null;
    try {
      target = kind === "pdf" ? openReportWindow() : null;
      await (kind === "csv" ? onCsv() : onPdf(target));
    } catch (err) {
      target?.close();
      const detail = getErrorMessage(err, "");
      message.error(detail || (err instanceof Error ? err.message : "No se pudo exportar el reporte"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dropdown
      disabled={disabled || busy !== null}
      menu={{
        items: [
          { key: "csv", label: "Exportar CSV", icon: <FileTextOutlined /> },
          { key: "pdf", label: "Exportar PDF", icon: <FilePdfOutlined /> },
        ],
        onClick: ({ key }) => void run(key as "csv" | "pdf"),
      }}
    >
      <Button icon={<DownloadOutlined />} loading={busy !== null}>
        Exportar <DownOutlined style={{ fontSize: 10 }} />
      </Button>
    </Dropdown>
  );
}
