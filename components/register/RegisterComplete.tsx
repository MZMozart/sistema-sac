import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';

interface RegisterCompleteProps {
  onFinish?: () => void;
}

export default function RegisterComplete({ onFinish }: RegisterCompleteProps) {
  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in glass-strong shadow-blue-glow">
      <CardHeader className="text-center space-y-2 pb-2">
        <CardTitle className="text-2xl font-bold">Cadastro concluído!</CardTitle>
        <CardDescription className="text-muted-foreground">Sua conta foi criada com sucesso. Bem-vindo à plataforma!</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <Button
          className="w-full h-12 text-base gap-3 bg-gradient-primary glow btn-press text-primary-foreground"
          variant="default"
          onClick={() => {
            if (typeof window !== "undefined") {
              // Busca tipo de conta salvo no localStorage ou no formData
              let type = 'pf';
              try {
                const saved = localStorage.getItem('registerType');
                if (saved && (saved === 'pj' || saved === 'pf')) type = saved;
              } catch {}
              // fallback para query ou pathname
              if (window.location.search.includes('type=PJ') || window.location.pathname.includes('pj')) type = 'pj';
              if (type === 'pj') {
                window.location.href = "/empresa/dashboard";
              } else {
                window.location.href = "/cliente/dashboard";
              }
            }
            if (onFinish) onFinish();
          }}
        >
          Ir para o Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
