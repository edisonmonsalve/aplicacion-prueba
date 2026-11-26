/* global document, localStorage */
// Se carga de forma bloqueante antes del bundle para evitar el destello de tema.
// Está en `public/` para poder servirse con una CSP estricta, sin scripts inline.
try {
  if (localStorage.getItem("theme-mode") === "dark") {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
  // La densidad compacta se aplica antes del primer pintado.
  if (localStorage.getItem("ui-density") === "compact") {
    document.documentElement.dataset.density = "compact";
  }
} catch {
  /* sin acceso a localStorage: se usa el tema claro y la densidad cómoda */
}
