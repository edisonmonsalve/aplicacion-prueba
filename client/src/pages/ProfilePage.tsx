import { useState } from "react";
import { App, Avatar, Button, Card, Segmented, Space, Tag, Typography, theme } from "antd";
import { KeyOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode } from "@/context/ThemeContext";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { roleColor, roleLabel } from "@/utils/roles";

export default function ProfilePage() {
  const { user } = useAuth();
  const { mode, toggle } = useThemeMode();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [passwordOpen, setPasswordOpen] = useState(false);

  useDocumentTitle("Mi perfil");

  if (!user) return null;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%", maxWidth: 720 }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Mi perfil
        </Typography.Title>
        <Typography.Text type="secondary">Consulta tus datos, cambia tu contraseña y ajusta la apariencia.</Typography.Text>
      </div>

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
      </Card>

      <Card title="Seguridad">
        <Button icon={<KeyOutlined />} onClick={() => setPasswordOpen(true)}>
          Cambiar contraseña
        </Button>
      </Card>

      <Card title="Apariencia">
        <Segmented
          value={mode}
          onChange={(v) => v !== mode && toggle()}
          options={[
            { value: "light", label: "Claro", icon: <SunOutlined /> },
            { value: "dark", label: "Oscuro", icon: <MoonOutlined /> },
          ]}
        />
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
  );
}
