"use client";

import { useEffect, useState } from "react";

/**
 * `<WelcomeOverlay />` — Splash de bienvenida personalizado al iniciar
 * sesión.
 *
 * Comportamiento:
 *  - Solo se muestra cuando `sessionStorage["cc-welcome"] === "1"`. La
 *    flag la setea la página de login al hacer signin exitoso (ver
 *    `app/(auth)/login/page.tsx`). Se consume (elimina) en el primer
 *    render para no repetir el splash en navegaciones posteriores.
 *  - Renderiza fullscreen con el banner del usuario (si tiene) como
 *    fondo, su avatar grande y un saludo según la hora.
 *  - Después de 2.2 s se desvanece y desmonta. Total ≈ 2.6 s con la
 *    animación de salida.
 *  - Si el usuario tiene `prefers-reduced-motion`, las animaciones se
 *    sustituyen por un fade simple.
 *
 * Personalización futura sencilla: cualquier dato del usuario que se
 * añada a `SessionUser` puede mostrarse aquí (cumpleaños, número de
 * notas, etc.) sin tocar layouts.
 */

interface WelcomeOverlayProps {
  name: string;
  image: string | null;
  imageFocusX: number | null;
  imageFocusY: number | null;
  profileBanner: string | null;
  bannerFocusX: number | null;
  bannerFocusY: number | null;
  departmentName: string | null;
  /** ISO yyyy-mm-dd. Para mostrar mensaje especial el día del cumple. */
  birthday: string | null;
}

const HIDE_AFTER_MS = 2200;
const UNMOUNT_AFTER_MS = 2800;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 13) return "Buenos días";
  if (h >= 13 && h < 21) return "Buenas tardes";
  return "Buenas noches";
}

function isBirthdayToday(iso: string | null): boolean {
  if (!iso) return false;
  const today = new Date();
  const [, mm, dd] = iso.split("-");
  return (
    parseInt(mm, 10) === today.getMonth() + 1 &&
    parseInt(dd, 10) === today.getDate()
  );
}

export function WelcomeOverlay({
  name,
  image,
  imageFocusX,
  imageFocusY,
  profileBanner,
  bannerFocusX,
  bannerFocusY,
  departmentName,
  birthday,
}: WelcomeOverlayProps) {
  // `null` = aún no decidido (SSR / primer paint client). `true` = mostrar.
  // `false` = ya consumido o no aplicable; no renderiza nada.
  const [visible, setVisible] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setVisible(false);
      return;
    }
    const flag = window.sessionStorage.getItem("cc-welcome");
    if (flag !== "1") {
      setVisible(false);
      return;
    }
    window.sessionStorage.removeItem("cc-welcome");
    setVisible(true);

    const t1 = window.setTimeout(() => setLeaving(true), HIDE_AFTER_MS);
    const t2 = window.setTimeout(() => setVisible(false), UNMOUNT_AFTER_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  const firstName = name.split(" ")[0] || name;
  const birthday_today = isBirthdayToday(birthday);
  const greeting = birthday_today
    ? `¡Feliz cumpleaños, ${firstName}!`
    : `${getGreeting()}, ${firstName}`;

  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";

  const avatarFocus =
    typeof imageFocusX === "number" && typeof imageFocusY === "number"
      ? `${imageFocusX}% ${imageFocusY}%`
      : "50% 30%";
  const bannerFocus =
    typeof bannerFocusX === "number" && typeof bannerFocusY === "number"
      ? `${bannerFocusX}% ${bannerFocusY}%`
      : "50% 50%";

  return (
    <div
      className={`welcome-overlay${leaving ? " welcome-overlay--leaving" : ""}`}
      role="status"
      aria-live="polite"
    >
      {/* Fondo: banner del usuario si tiene, si no degradado violeta */}
      {profileBanner ? (
        <div
          className="welcome-overlay__bg"
          style={{
            backgroundImage: `url("${profileBanner}")`,
            backgroundPosition: bannerFocus,
          }}
        />
      ) : (
        <div className="welcome-overlay__bg welcome-overlay__bg--default" />
      )}
      <div className="welcome-overlay__veil" />

      {/* Orbes decorativos magenta y púrpura */}
      <div className="welcome-overlay__orb welcome-overlay__orb--1" />
      <div className="welcome-overlay__orb welcome-overlay__orb--2" />
      <div className="welcome-overlay__orb welcome-overlay__orb--3" />

      {/* Contenido */}
      <div className="welcome-overlay__content">
        <div className="welcome-overlay__avatar">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={name}
              style={{ objectPosition: avatarFocus }}
            />
          ) : (
            <span className="welcome-overlay__initials">{initials}</span>
          )}
        </div>
        <p className="welcome-overlay__greeting">{greeting}</p>
        {departmentName && (
          <p className="welcome-overlay__dept">{departmentName}</p>
        )}
        {birthday_today && (
          <p className="welcome-overlay__birthday">
            🎂 Que tengas un día genial
          </p>
        )}
      </div>
    </div>
  );
}
