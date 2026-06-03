/**
 * Politica minima de password aplicada en endpoints que crean/cambian
 * contrasenas (POST /api/users, PATCH /api/users/[id], reset, etc.).
 *
 * Reglas:
 *   - Minimo 8 caracteres (NIST 800-63B). Anteriormente era 12; bajado a
 *     peticion explicita del propietario. Compensamos con la regla de
 *     complejidad y la lista negra de contrasenas comunes.
 *   - Al menos 3 de las 4 clases (mayuscula, minuscula, digito, simbolo)
 *     para forzar entropia razonable sin caer en el sin-sentido de
 *     "1Mayus+1Num+1Sim" que la gente esquiva con `Password1!`.
 *   - Maximo 256 caracteres (DoS por bcrypt en strings absurdamente largos).
 *   - Bloqueo de passwords comunes hardcodeados (la lista es pequena pero
 *     evita los "Password123!" mas obvios). Si crece, mover a fichero.
 *
 * No bloqueamos por similitud con el email o el nombre por simplicidad;
 * lo hace `failedLoginAttempts + lockedUntil` desde la cara opuesta.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 256;

const COMMON_PASSWORDS = new Set<string>([
  "password",
  "passwordpassword",
  "p@ssword1234",
  "password1234",
  "qwerty123456",
  "admin1234567",
  "letmein12345",
  "welcome12345",
  "abcd1234efgh",
  "123456789012",
  "ccops2024!",
  "ccops2024aaa",
  "admin2024!aa",
  "superadmin2024",
]);

function passesComplexity(pw: string): boolean {
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  return classes >= 3;
}

export type PasswordValidation =
  | { ok: true }
  | { ok: false; error: string };

export function validatePasswordPolicy(pw: unknown): PasswordValidation {
  if (typeof pw !== "string") {
    return { ok: false, error: "La contraseña es obligatoria." };
  }
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }
  if (pw.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`,
    };
  }
  if (!passesComplexity(pw)) {
    return {
      ok: false,
      error:
        "La contraseña debe combinar al menos 3 de: mayúsculas, minúsculas, números y símbolos.",
    };
  }
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    return { ok: false, error: "Esa contraseña es demasiado común." };
  }
  return { ok: true };
}
