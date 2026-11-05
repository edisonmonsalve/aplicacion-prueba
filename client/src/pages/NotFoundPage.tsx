import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function NotFoundPage() {
  const navigate = useNavigate();
  useDocumentTitle("No encontrada");

  return (
    <Result
      status="404"
      title="404"
      subTitle="La página que buscas no existe."
      extra={
        <Button type="primary" onClick={() => navigate("/")}>
          Volver al inicio
        </Button>
      }
    />
  );
}
