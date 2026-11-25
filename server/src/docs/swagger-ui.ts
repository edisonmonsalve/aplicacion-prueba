/**
 * Interfaz de la API sin dependencias npm: Swagger UI se carga desde un CDN.
 * Si no hay red, el JSON crudo sigue disponible en `/api/openapi.json`.
 */
export const swaggerUiHtml = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Signal · Documentación de la API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; font-family: system-ui, sans-serif; }
    .signal-header {
      background: #0b1f1c; color: #fff; padding: 14px 24px;
      display: flex; align-items: center; gap: 16px; font-size: 14px;
    }
    .signal-header strong { font-size: 16px; letter-spacing: .02em; }
    .signal-header a { color: #7ee0c0; }
    .signal-header code { color: #c7f5e4; }
  </style>
</head>
<body>
  <header class="signal-header">
    <strong>Signal API</strong>
    <span>Especificación generada desde los esquemas Zod del servidor</span>
    <a href="/api/openapi.json">Ver JSON</a>
  </header>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {
      window.SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: false,
        requestInterceptor: function (request) {
          var token = localStorage.getItem("token");
          if (token) request.headers.Authorization = "Bearer " + token;
          return request;
        }
      });
    };
  </script>
</body>
</html>
`;
