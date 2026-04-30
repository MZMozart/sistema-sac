import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';

interface RegisterDocumentsProps {
  formData: any;
  setFormData: (data: any) => void;
  errors: any;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNext: () => void;
}

export default function RegisterDocuments({ formData, setFormData, errors, onUpload, onNext }: RegisterDocumentsProps) {
  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in glass-strong shadow-blue-glow">
      <CardHeader className="text-center space-y-2 pb-2">
        <CardTitle className="text-2xl font-bold">Upload de Documentos</CardTitle>
        <CardDescription className="text-muted-foreground">Envie seus documentos para finalizar o cadastro</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); onNext(); }}>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={onUpload}
            className="w-full border rounded p-2 bg-card/60"
          />
          {errors.document && <div className="text-red-500 text-xs">{errors.document}</div>}
          <Button type="submit" variant="default" className="w-full h-12 text-base gap-3 bg-gradient-primary glow btn-press text-primary-foreground mt-2">Avançar</Button>
        </form>
      </CardContent>
    </Card>
  );
}
