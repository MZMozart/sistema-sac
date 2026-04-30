import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export default function RegisterCNPJResult({ formData, setFormData, onNext, onBack }: {
  formData: any,
  setFormData: (data: any) => void,
  onNext: () => void,
  onBack: () => void
}) {
  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in glass-strong shadow-blue-glow">
      <CardHeader className="text-center space-y-2 pb-2">
        <CardTitle className="text-2xl font-bold">Confirme os dados da empresa</CardTitle>
        <CardDescription className="text-muted-foreground">Confira e edite se necessário</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); onNext(); }}>
          <label className="block mb-1 font-medium">Razão Social</label>
          <Input
            type="text"
            placeholder="Razão Social"
            value={formData.company || ''}
            onChange={e => setFormData({ ...formData, company: e.target.value })}
            className="h-12 bg-secondary/50 border-border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          <label className="block mb-1 font-medium">Nome Fantasia</label>
          <Input
            type="text"
            placeholder="Nome Fantasia"
            value={formData.tradeName || ''}
            onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
            className="h-12 bg-secondary/50 border-border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          <label className="block mb-1 font-medium">Nome Completo do Responsável</label>
          <Input
            type="text"
            placeholder="Nome Completo do Responsável"
            value={formData.name || ''}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="h-12 bg-secondary/50 border-border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          <div className="flex gap-2 w-full">
            <Button variant="secondary" type="button" onClick={onBack} className="w-1/3">Voltar</Button>
            <Button variant="default" type="submit" className="w-2/3 h-12 text-base gap-3 bg-gradient-primary glow btn-press text-primary-foreground">Confirmar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
