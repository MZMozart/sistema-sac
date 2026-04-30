import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './phone-input-custom.css';

interface RegisterPhoneProps {
  formData: any;
  setFormData: (data: any) => void;
  errors: any;
  onNext: () => void;
}

export default function RegisterPhone({ formData, setFormData, errors, onNext }: RegisterPhoneProps) {
  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in glass-strong shadow-blue-glow">
      <CardHeader className="text-center space-y-2 pb-2">
        <CardTitle className="text-2xl font-bold">Telefone</CardTitle>
        <CardDescription className="text-muted-foreground">Informe seu telefone internacional</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); onNext(); }}>
          <PhoneInput
            international
            defaultCountry="BR"
            value={formData.phone || ''}
            onChange={phone => setFormData({ ...formData, phone })}
            className={"phone-input-custom w-full h-12 bg-secondary/80 text-foreground border-border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-md px-3 py-2 text-base" + (errors.phone ? ' border-red-500' : '')}
            limitMaxLength={true}
            placeholder="Selecione o país e digite o número"
          />
          {errors.phone && <div className="text-red-500 text-xs">{errors.phone}</div>}
          <Button
            type="submit"
            variant="default"
            className="w-full h-12 text-base gap-3 bg-gradient-primary glow btn-press text-primary-foreground"
          >
            Avançar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
