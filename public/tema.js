// Aplica el tema guardado antes del primer pintado: sin esto la página
// arranca en blanco y recién cambia a oscuro cuando carga React. Va en un
// archivo aparte (no inline en index.html) para que la CSP no tenga que
// permitir scripts inline.
try {
  var t = localStorage.getItem("theme");
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.classList.toggle("dark", t === "dark");
  document.documentElement.style.colorScheme = t;
} catch (e) {}
