"use client";

export function SkipToMain() {
  return (
    <a
      href="#main-content"
      className="skip-to-main"
      onClick={(e) => {
        e.preventDefault();
        const main = document.getElementById("main-content");
        if (main) {
          main.focus();
          main.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }}
    >
      Saltar al contenido
    </a>
  );
}
