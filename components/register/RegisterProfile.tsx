
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface RegisterProfileProps {
  formData: {
    name?: string;
    cpf?: string;
    cnpj?: string;
    [key: string]: any;
  };
  setFormData: (data: any) => void;
  errors: {
    name?: string;
    cpf?: string;
    cnpj?: string;
    [key: string]: any;
  };
  accountType: 'pf' | 'pj';
  handleCPFChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCNPJChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNext: () => void;
}

export default function RegisterProfile({ formData, setFormData, errors, accountType, handleCPFChange, handleCNPJChange, onNext }: RegisterProfileProps) {
  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in glass-strong shadow-blue-glow">
      <CardHeader className="text-center space-y-2 pb-2">
        <CardTitle className="text-2xl font-bold">Complete seu perfil</CardTitle>
        <CardDescription className="text-muted-foreground">Preencha seus dados pessoais</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); onNext(); }}>
          {accountType === 'pf' && (
            <>
              <label className="block mb-1 font-medium">Nome completo</label>
              <Input
                type="text"
                placeholder="Nome completo"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? 'border-red-500' : ''}
                autoFocus
              />
              {errors.name && <div className="text-red-500 text-xs">{errors.name}</div>}
              <label className="block mb-1 font-medium">Data de nascimento</label>
              <Input
                type="date"
                placeholder="Data de nascimento"
                value={formData.birthdate || ''}
                onChange={e => setFormData({ ...formData, birthdate: e.target.value })}
                className={errors.birthdate ? 'border-red-500' : ''}
              />
              {errors.birthdate && <div className="text-red-500 text-xs">{errors.birthdate}</div>}
            </>
          )}
          {accountType === 'pj' && (
            <>
              <Input
                type="text"
                placeholder="Razão social"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? 'border-red-500' : ''}
                autoFocus
              />
              {errors.name && <div className="text-red-500 text-xs">{errors.name}</div>}
              <Input
                type="text"
                placeholder="CNPJ"
                value={formData.cnpj || ''}
                onChange={handleCNPJChange}
                className={errors.cnpj ? 'border-red-500' : ''}
              />
              {errors.cnpj && <div className="text-red-500 text-xs">{errors.cnpj}</div>}
            </>
          )}
          <Button
            type="submit"
            className="w-full h-12 text-base gap-3 bg-gradient-primary glow btn-press text-primary-foreground"
          >
            Avançar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
