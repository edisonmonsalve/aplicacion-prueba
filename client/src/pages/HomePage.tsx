import { Typography } from "antd";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <Typography.Title level={2}>Hola, {user?.nombre}</Typography.Title>
      <Typography.Paragraph>
        Usa el menú de la izquierda para navegar entre los módulos.
      </Typography.Paragraph>
    </>
  );
}