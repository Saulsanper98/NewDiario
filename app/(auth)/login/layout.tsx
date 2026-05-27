/**
 * Script inline para aplicar la preferencia "efectos del login" antes del
 * primer pintado. Lee `localStorage` y, si el usuario los desactivó, marca
 * `<html data-login-effects="off">`. CSS oculta entonces toda la escena
 * pesada (vignette, capas de fondo, shimmer, etc.) sin que el navegador
 * llegue a pintarla. Imprescindible en PCs lentos.
 */
const initScript = `(function(){try{if(localStorage.getItem('cc-ops-login-effects')==='0'){document.documentElement.dataset.loginEffects='off';}}catch(e){}})();`;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: initScript }} />
      {children}
    </>
  );
}
