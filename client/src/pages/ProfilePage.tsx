import { useState } from "react";
import { App, Avatar, Button, Card, Space, Tag, Typography, theme } from "antd";
import { KeyOutlined } from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import PageHeader from "@/components/PageHeader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { roleColor, roleLabel } from "@/utils/roles";

export default function ProfilePage() {
  const { user } = useAuth();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [passwordOpen, setPasswordOpen] = useState(false);

  useDocumentTitle("Mi perfil");

  if (!user) return null;

  return (
    <div style={{ width: "100%", maxWidth: 720 }}>
      <PageHeader
        title="Mi perfil"
        description="Consulta tus datos y cambia tu contraseña."
      />

      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Card>
          <Space size="large">
            <Avatar size={72} style={{ background: token.colorPrimary, fontSize: 32 }}>
              {user.nombre[0]?.toUpperCase()}
            </Avatar>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {user.nombre}
              </Typography.Title>
              <Typography.Text type="secondary">{user.email}</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Tag color={roleColor(user.rol)}>{roleLabel(user.rol)}</Tag>
              </div>
            </div>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 16 }}>
            Tu nombre, correo y rol los modifica un administrador. Si necesitas cambiarlos, pídeselo a un
            administrador. El tema claro u oscuro se cambia desde el interruptor del encabezado.
          </Typography.Paragraph>
        </Card>

        <Card title="Seguridad">
          <Button icon={<KeyOutlined />} onClick={() => setPasswordOpen(true)}>
            Cambiar contraseña
          </Button>
        </Card>

        {passwordOpen && (
          <ChangePasswordModal
            onClose={() => setPasswordOpen(false)}
            onSaved={() => {
              setPasswordOpen(false);
              message.success("Contraseña actualizada");
            }}
          />
        )}
      </Space>
    </div>
  );
}
