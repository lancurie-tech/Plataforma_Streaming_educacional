import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Garante que, ao navegar entre rotas, a vista começa no topo (evita herdar scroll da página anterior).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}
