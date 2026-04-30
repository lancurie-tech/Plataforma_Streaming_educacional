import { useNavigate } from 'react-router-dom';
import { PublicWelcomeOverlay } from '@/components/layout/PublicWelcomeOverlay';

/**
 * Rota `/` — apenas o ecrã de boas-vindas; em seguida `replace` para `/streaming`.
 * O conteúdo de streaming público está em {@link StreamingHomePage} em `/streaming`.
 */
export function WelcomeGatePage() {
  const navigate = useNavigate();
  return (
    <PublicWelcomeOverlay
      variant="gate"
      onComplete={() => navigate('/streaming', { replace: true })}
    />
  );
}
