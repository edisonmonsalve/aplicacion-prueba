import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function LoginPage() {
  return <h1>Login</h1>;
}
function UsersPage() {
  return <h1>Usuarios</h1>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}