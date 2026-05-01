
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2, Mail, Search, ShieldCheck, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PhoneInput } from "@/components/phone-input";
import { useAuth } from "@/contexts/auth-context";
import { maskCPF, maskCNPJ } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { firebaseEnvReady } from "@/lib/firebase";
import { toast } from "sonner";

type RegisterType = "pf" | "pj";

const companySegments = [
  "Varejo",
  "E-commerce",
  "Saúde",
  "Educação",
  "Financeiro",
  "Logística",
  "Alimentação",
  "Serviços",
  "Tecnologia",
  "Imobiliário",
  "Jurídico",
  "Turismo",
  "Beleza",
  "Automotivo",
  "Outro",
];

const genderOptions = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "nao-binario", label: "Não-binário" },
  { value: "prefiro-nao-informar", label: "Prefiro não informar" },
  { value: "outro", label: "Outro" },
];

export default function RegisterPage() {
  const { signInWithGoogle, signUp } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<RegisterType | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    ownerFullName: "",
    gender: "",
    cpf: "",
    phone: "",
    fullPhone: "",
    birthdate: "",
    profilePhoto: "",
    documents: [] as string[],
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    segmento: "",
    customSegmento: "",
    horarioInicio: "08:00",
    horarioFim: "18:00",
    horarioAlmocoInicio: "12:00",
    horarioAlmocoFim: "13:00",
    botPolicies: "Atenda com cordialidade, responda com base na política da empresa e transfira para humano quando o cliente pedir ou quando a política não cobrir o caso.",
    uraScript: "1 - Financeiro\n2 - Suporte\n3 - Comercial",
    website: "",
    cep: "",
    address: "",
    neighborhood: "",
    city: "",
    state: "",
    acceptTerms: false,
  });
  const [cpfStatus, setCpfStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [autoFillLoading, setAutoFillLoading] = useState(false);

  const steps = useMemo(
    () => (accountType === "pj" ? ["tipo", "credenciais", "empresa", "operacao"] : ["tipo", "credenciais", "perfil", "confirmacao"]),
    [accountType]
  );

  const progress = ((step + 1) / steps.length) * 100;

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDocumentsChange = (files: FileList | null) => {
    setFormData((prev) => ({
      ...prev,
      documents: files ? Array.from(files).map((file) => file.name) : [],
    }));
  };

  const handleCpfValidation = async () => {
    if (formData.cpf.length !== 11) return;
    try {
      const response = await fetch(`/api/cpf/${formData.cpf}`);
      setCpfStatus(response.ok ? "valid" : "invalid");
    } catch {
      setCpfStatus("invalid");
    }
  };

  const handleCepLookup = async () => {
    const cep = formData.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;

    setAutoFillLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) throw new Error();

      setFormData((prev) => ({
        ...prev,
        cep,
        address: data.logradouro || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
      toast.success("CEP preenchido automaticamente.");
    } catch {
      toast.error("Não consegui preencher o CEP automaticamente.");
    } finally {
      setAutoFillLoading(false);
    }
  };

  const handleCnpjLookup = async () => {
    const cnpj = formData.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) return;

    setAutoFillLoading(true);
    try {
      const response = await fetch(`/api/cnpj/${cnpj}`);
      const data = await response.json();
      if (!response.ok) throw new Error();

      setFormData((prev) => ({
        ...prev,
        razaoSocial: data.nome || prev.razaoSocial,
        nomeFantasia: data.fantasia || prev.nomeFantasia,
        phone: prev.phone || (data.telefone ? String(data.telefone).replace(/\D/g, "") : ""),
        cep: data.cep ? String(data.cep).replace(/\D/g, "") : prev.cep,
        address: [data.logradouro, data.numero].filter(Boolean).join(", ") || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
      }));
      toast.success("CNPJ preenchido automaticamente.");
    } catch {
      toast.error("Não foi possível consultar o CNPJ agora.");
    } finally {
      setAutoFillLoading(false);
    }
  };

  const goNext = () => setStep((value) => Math.min(value + 1, steps.length - 1));
  const goBack = () => setStep((value) => Math.max(value - 1, 0));

  const validateCurrentStep = () => {
    if (step === 0 && !accountType) {
      toast.error("Escolha se a conta é PF ou PJ.");
      return false;
    }

    if (steps[step] === "credenciais") {
      if (!formData.email || !formData.password || formData.password.length < 6) {
        toast.error("Informe email e senha com pelo menos 6 caracteres.");
        return false;
      }
    }

    if (steps[step] === "perfil") {
      if (!formData.fullName || !formData.gender || formData.cpf.length !== 11 || !formData.phone || !formData.birthdate) {
        toast.error("Preencha nome, gênero, CPF, data de nascimento e telefone para continuar.");
        return false;
      }
    }

    if (steps[step] === "empresa") {
      if (!formData.ownerFullName || !formData.razaoSocial || formData.cnpj.length !== 14 || !formData.phone || !formData.segmento) {
        toast.error("Preencha dono, razão social, CNPJ, setor e telefone da empresa.");
        return false;
      }
    }

    if (steps[step] === "operacao") {
      if (!formData.horarioInicio || !formData.horarioFim || !formData.botPolicies) {
        toast.error("Defina horário de atendimento e política inicial do BOT.");
        return false;
      }

      if (formData.documents.length === 0 || !formData.acceptTerms) {
        toast.error("Envie ao menos um documento e aceite os termos para continuar.");
        return false;
      }
    }

    if (steps[step] === "confirmacao") {
      if (formData.documents.length === 0 || !formData.acceptTerms) {
        toast.error("Envie ao menos um documento e aceite os termos para continuar.");
        return false;
      }
    }

    return true;
  };

  const handleGoogle = async () => {
    if (!accountType) {
      toast.error("Escolha PF ou PJ antes de continuar com Google.");
      return;
    }
    if (!firebaseEnvReady) {
      toast.error("Firebase não configurado na Vercel. Cadastre as variáveis NEXT_PUBLIC_FIREBASE_* antes de usar o cadastro Google.");
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle(accountType);
      toast.success("Conta criada com Google com sucesso.");
    } catch (error: any) {
      if (error?.code === "auth/unauthorized-domain") {
        toast.error("O domínio atual ainda não foi autorizado no Firebase para login Google.");
      } else if (error?.code === "auth/popup-blocked") {
        toast.error("Popup bloqueado pelo navegador. Permita popups para este site e tente novamente.");
      } else {
        toast.error(error?.message || "Não foi possível continuar com Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!validateCurrentStep() || !accountType) return;

    setLoading(true);
    try {
      await signUp(formData.email, formData.password, accountType, {
        fullName: accountType === "pf" ? formData.fullName : formData.ownerFullName,
        ownerFullName: formData.ownerFullName,
        name: accountType === "pf" ? formData.fullName : formData.nomeFantasia || formData.razaoSocial,
        gender: formData.gender as any,
        cpf: formData.cpf,
        cnpj: formData.cnpj,
        phone: formData.fullPhone || formData.phone,
        address: [formData.address, formData.neighborhood, formData.city, formData.state].filter(Boolean).join(' - '),
        neighborhood: formData.neighborhood,
        cep: formData.cep,
        city: formData.city,
        state: formData.state,
        dateOfBirth: formData.birthdate,
        documents: formData.documents,
        razaoSocial: formData.razaoSocial,
        nomeFantasia: formData.nomeFantasia,
        segmento: formData.segmento === "Outro" ? formData.customSegmento : formData.segmento,
        botPolicies: formData.botPolicies,
        horarioInicio: formData.horarioInicio,
        horarioFim: formData.horarioFim,
        horarioAlmocoInicio: formData.horarioAlmocoInicio,
        horarioAlmocoFim: formData.horarioAlmocoFim,
        website: formData.website,
        settings: {
          uraScript: formData.uraScript,
        },
      });
      toast.success(accountType === "pj" ? "Conta empresarial criada. Vamos finalizar sua empresa." : "Conta criada com sucesso.");
    } catch (error: any) {
      if (error?.code === "auth/email-already-in-use") {
        toast.error("Este email já está em uso. Entre com ele ou use a recuperação de senha.");
      } else {
        toast.error(error?.message || "Erro ao criar conta.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderTypeStep = () => (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        {
          type: "pf" as RegisterType,
          title: "Pessoa Física",
          description: "Cliente que busca empresas, reputação e atendimento por chat ou ligação.",
          icon: UserRound,
        },
        {
          type: "pj" as RegisterType,
          title: "Pessoa Jurídica",
          description: "Empresa que configura BOT, equipe, filas, URA, dashboards e reputação pública.",
          icon: Building2,
        },
      ].map((option) => (
        <button
          key={option.type}
          type="button"
          data-testid={`register-${option.type}-option`}
          onClick={() => {
            setAccountType(option.type);
            setStep(1);
          }}
          className={`card-hover rounded-3xl border p-5 text-left ${accountType === option.type ? "border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(37,99,235,0.24)]" : "border-border bg-card/80"}`}
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-white">
            <option.icon className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-semibold">{option.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
        </button>
      ))}
    </div>
  );

  const renderCredentialsStep = () => (
    <div className="space-y-5">
      <Button type="button" variant="outline" className="h-12 w-full justify-center gap-3" data-testid="register-google-button" onClick={handleGoogle} disabled={loading}>
        <Mail className="h-4 w-4" />
        Continuar com Google
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <span className="relative mx-auto block w-fit bg-card px-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">ou com email</span>
      </div>
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input id="register-email" data-testid="register-email-input" type="email" placeholder="voce@empresa.com" value={formData.email} onChange={(event) => updateField("email", event.target.value)} className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Senha segura</Label>
          <Input id="register-password" data-testid="register-password-input" type="password" placeholder="Mínimo 6 caracteres" value={formData.password} onChange={(event) => updateField("password", event.target.value)} className="h-12" />
        </div>
      </div>
    </div>
  );

  const renderProfileStep = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-full-name">Nome completo</Label>
        <Input id="register-full-name" data-testid="register-full-name-input" placeholder="Seu nome completo" value={formData.fullName} onChange={(event) => updateField("fullName", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label>Gênero</Label>
        <Select value={formData.gender} onValueChange={(value) => updateField("gender", value)}>
          <SelectTrigger data-testid="register-gender-select">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {genderOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-cpf">CPF</Label>
        <div className="flex gap-2">
          <Input id="register-cpf" data-testid="register-cpf-input" placeholder="000.000.000-00" value={maskCPF(formData.cpf)} onChange={(event) => updateField("cpf", event.target.value.replace(/\D/g, ""))} onBlur={handleCpfValidation} className="h-12" maxLength={14} />
          <Button type="button" variant="outline" onClick={handleCpfValidation} data-testid="register-cpf-validate-button">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <p className={`text-xs ${cpfStatus === "valid" ? "text-emerald-500" : cpfStatus === "invalid" ? "text-red-500" : "text-muted-foreground"}`} data-testid="register-cpf-status">
          {cpfStatus === "valid" ? "CPF validado. Nome e nascimento podem ser reforçados pelo documento enviado." : cpfStatus === "invalid" ? "CPF inválido." : "Digite o CPF para validar gratuitamente."}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-birthdate">Data de nascimento</Label>
        <Input id="register-birthdate" data-testid="register-birthdate-input" type="date" value={formData.birthdate} onChange={(event) => updateField("birthdate", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Telefone</Label>
        <PhoneInput value={formData.phone} onChange={(value, fullNumber) => setFormData((prev) => ({ ...prev, phone: value, fullPhone: fullNumber }))} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-cep">CEP</Label>
        <div className="flex gap-2">
          <Input id="register-cep" data-testid="register-cep-input" placeholder="00000-000" value={formData.cep} onChange={(event) => updateField("cep", event.target.value.replace(/\D/g, ""))} className="h-12" maxLength={8} />
          <Button type="button" variant="outline" onClick={handleCepLookup} disabled={autoFillLoading} data-testid="register-cep-lookup-button">
            {autoFillLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-address">Endereço</Label>
        <Input id="register-address" data-testid="register-address-input" placeholder="Rua, número, cidade e estado" value={formData.address} onChange={(event) => updateField("address", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-neighborhood">Bairro</Label>
        <Input id="register-neighborhood" data-testid="register-neighborhood-input" placeholder="Bairro" value={formData.neighborhood} onChange={(event) => updateField("neighborhood", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-city">Cidade / UF</Label>
        <Input id="register-city" data-testid="register-city-input" placeholder="Cidade - UF" value={[formData.city, formData.state].filter(Boolean).join(' - ')} onChange={(event) => updateField("city", event.target.value)} className="h-12" />
      </div>
    </div>
  );

  const renderCompanyStep = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-owner-full-name">Nome completo do dono</Label>
        <Input id="register-owner-full-name" data-testid="register-owner-full-name-input" placeholder="Nome completo do responsável" value={formData.ownerFullName} onChange={(event) => updateField("ownerFullName", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-razao-social">Razão social</Label>
        <Input id="register-razao-social" data-testid="register-razao-social-input" placeholder="Nome jurídico da empresa" value={formData.razaoSocial} onChange={(event) => updateField("razaoSocial", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-nome-fantasia">Nome fantasia</Label>
        <Input id="register-nome-fantasia" data-testid="register-nome-fantasia-input" placeholder="Nome público da empresa" value={formData.nomeFantasia} onChange={(event) => updateField("nomeFantasia", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-cnpj">CNPJ</Label>
        <div className="flex gap-2">
          <Input id="register-cnpj" data-testid="register-cnpj-input" placeholder="00.000.000/0000-00" value={maskCNPJ(formData.cnpj)} onChange={(event) => updateField("cnpj", event.target.value.replace(/\D/g, ""))} onBlur={handleCnpjLookup} className="h-12" maxLength={18} />
          <Button type="button" variant="outline" onClick={handleCnpjLookup} disabled={autoFillLoading} data-testid="register-cnpj-lookup-button">
            {autoFillLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Telefone corporativo</Label>
        <PhoneInput value={formData.phone} onChange={(value, fullNumber) => setFormData((prev) => ({ ...prev, phone: value, fullPhone: fullNumber }))} />
      </div>
      <div className="space-y-2">
        <Label>Setor principal</Label>
        <Select value={formData.segmento} onValueChange={(value) => updateField("segmento", value)}>
          <SelectTrigger data-testid="register-segment-select">
            <SelectValue placeholder="Selecione o setor" />
          </SelectTrigger>
          <SelectContent>
            {companySegments.map((segment) => (
              <SelectItem key={segment} value={segment}>{segment}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-custom-segment">Área personalizada</Label>
        <Input id="register-custom-segment" data-testid="register-custom-segment-input" placeholder="Ex: Marketplace de moda" value={formData.customSegmento} onChange={(event) => updateField("customSegmento", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-company-cep">CEP</Label>
        <div className="flex gap-2">
          <Input id="register-company-cep" data-testid="register-company-cep-input" placeholder="00000-000" value={formData.cep} onChange={(event) => updateField("cep", event.target.value.replace(/\D/g, ""))} className="h-12" maxLength={8} />
          <Button type="button" variant="outline" onClick={handleCepLookup} disabled={autoFillLoading} data-testid="register-company-cep-lookup-button">
            {autoFillLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-company-address">Endereço</Label>
        <Input id="register-company-address" data-testid="register-company-address-input" placeholder="Rua, número, cidade e estado" value={formData.address} onChange={(event) => updateField("address", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-company-neighborhood">Bairro</Label>
        <Input id="register-company-neighborhood" data-testid="register-company-neighborhood-input" placeholder="Bairro" value={formData.neighborhood} onChange={(event) => updateField("neighborhood", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-company-city">Cidade / UF</Label>
        <Input id="register-company-city" data-testid="register-company-city-input" placeholder="Cidade - UF" value={[formData.city, formData.state].filter(Boolean).join(' - ')} onChange={(event) => updateField("city", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-website">Website</Label>
        <Input id="register-website" data-testid="register-website-input" placeholder="https://empresa.com.br" value={formData.website} onChange={(event) => updateField("website", event.target.value)} className="h-12" />
      </div>
    </div>
  );

  const renderOperationStep = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="register-open-time">Início do atendimento</Label>
        <Input id="register-open-time" data-testid="register-open-time-input" type="time" value={formData.horarioInicio} onChange={(event) => updateField("horarioInicio", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-close-time">Fim do atendimento</Label>
        <Input id="register-close-time" data-testid="register-close-time-input" type="time" value={formData.horarioFim} onChange={(event) => updateField("horarioFim", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-lunch-start">Início do almoço</Label>
        <Input id="register-lunch-start" data-testid="register-lunch-start-input" type="time" value={formData.horarioAlmocoInicio} onChange={(event) => updateField("horarioAlmocoInicio", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-lunch-end">Fim do almoço</Label>
        <Input id="register-lunch-end" data-testid="register-lunch-end-input" type="time" value={formData.horarioAlmocoFim} onChange={(event) => updateField("horarioAlmocoFim", event.target.value)} className="h-12" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-bot-policies">Políticas iniciais do BOT</Label>
        <Textarea id="register-bot-policies" data-testid="register-bot-policies-input" value={formData.botPolicies} onChange={(event) => updateField("botPolicies", event.target.value)} className="min-h-[140px]" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-ura-script">Script inicial da URA</Label>
        <Textarea id="register-ura-script" data-testid="register-ura-script-input" value={formData.uraScript} onChange={(event) => updateField("uraScript", event.target.value)} className="min-h-[120px]" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="register-documents">Documentos para autenticação básica</Label>
        <Input id="register-documents" data-testid="register-documents-input" type="file" multiple onChange={(event) => handleDocumentsChange(event.target.files)} />
        <p className="text-xs text-muted-foreground">Upload gratuito obrigatório para validação inicial do cadastro.</p>
      </div>
      <label className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground md:col-span-2">
        <input type="checkbox" checked={formData.acceptTerms} onChange={(event) => setFormData((prev) => ({ ...prev, acceptTerms: event.target.checked }))} data-testid="register-accept-terms-checkbox" className="mt-1" />
        <span>
          Li e aceito os <Link href="/termos-de-uso" className="text-primary underline">Termos de Uso</Link> e a <Link href="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
        </span>
      </label>
    </div>
  );

  const renderConfirmationStep = () => (
    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-white shadow-[0_20px_48px_-22px_rgba(37,99,235,0.55)]">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h3 className="text-2xl font-semibold">Tudo certo para criar sua conta</h3>
      <p className="mt-2 text-sm text-muted-foreground">Seu perfil será criado com autenticação por email, recuperação de senha e opção de login social com Google.</p>
      <div className="mt-5 rounded-2xl bg-card p-4 text-left text-sm text-muted-foreground">
        <p><span className="font-medium text-foreground">Nome:</span> {formData.fullName}</p>
        <p className="mt-1"><span className="font-medium text-foreground">CPF:</span> {maskCPF(formData.cpf)}</p>
        <p className="mt-1"><span className="font-medium text-foreground">Contato:</span> {formData.fullPhone || formData.phone}</p>
      </div>
      <div className="mt-4 space-y-2 text-left text-sm text-muted-foreground">
        <Label htmlFor="register-documents-final">Documentos enviados</Label>
        <Input id="register-documents-final" data-testid="register-documents-final-input" type="file" multiple onChange={(event) => handleDocumentsChange(event.target.files)} />
        <p>{formData.documents.length > 0 ? `${formData.documents.length} documento(s) anexado(s).` : 'Envie ao menos um documento para autenticação básica gratuita.'}</p>
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-card/70 p-4 text-left text-sm text-muted-foreground">
        <input type="checkbox" checked={formData.acceptTerms} onChange={(event) => setFormData((prev) => ({ ...prev, acceptTerms: event.target.checked }))} data-testid="register-accept-terms-final-checkbox" className="mt-1" />
        <span>
          Li e aceito os <Link href="/termos-de-uso" className="text-primary underline">Termos de Uso</Link>, a <Link href="/privacidade" className="text-primary underline">Política de Privacidade</Link> e quero concluir meu cadastro.
        </span>
      </label>
    </div>
  );

  const currentStep = steps[step];

  return (
    <div className="mesh-background min-h-screen overflow-hidden">
      <header className="glass-strong fixed inset-x-0 top-0 z-50 border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground" data-testid="register-back-home-link">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <Logo size="sm" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-10 px-4 pb-8 pt-24 lg:flex-row lg:items-center">
        <section className="w-full max-w-xl">
          <div className="mb-6 flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Cadastro seguro multiempresa
          </div>
          <h1 className="text-4xl font-extrabold leading-tight text-balance sm:text-5xl">Crie sua conta premium para atendimento inteligente.</h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">Fluxo completo para cliente PF ou empresa PJ com base pronta para BOT, equipe, dashboards, URA e reputação pública.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              "Login por email, senha e Google",
              "Onboarding PJ com horários e políticas",
              "Estrutura pronta para chat, voz e analytics",
            ].map((item) => (
              <div key={item} className="glass rounded-2xl border border-border p-4 text-sm text-muted-foreground">{item}</div>
            ))}
          </div>
        </section>

        <section className="w-full max-w-2xl">
          <Card className="glass-strong animate-scale-in rounded-[2rem] border-border shadow-[0_24px_120px_-48px_rgba(15,23,42,0.4)]">
            <CardHeader className="space-y-4 border-b border-border/70 pb-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-3xl">{accountType === "pj" ? "Cadastro empresarial" : accountType === "pf" ? "Cadastro de cliente" : "Escolha seu perfil"}</CardTitle>
                  <CardDescription className="mt-2 text-sm sm:text-base">Passo {step + 1} de {steps.length} — {currentStep}</CardDescription>
                </div>
                <div className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {accountType ? accountType.toUpperCase() : "Início"}
                </div>
              </div>
              <Progress value={progress} className="h-2" data-testid="register-progress-bar" />
            </CardHeader>
            <CardContent className="space-y-6 p-6 sm:p-8">
              {currentStep === "tipo" && renderTypeStep()}
              {currentStep === "credenciais" && renderCredentialsStep()}
              {currentStep === "perfil" && renderProfileStep()}
              {currentStep === "empresa" && renderCompanyStep()}
              {currentStep === "operacao" && renderOperationStep()}
              {currentStep === "confirmacao" && renderConfirmationStep()}

              <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0 || loading} data-testid="register-back-button">
                  Voltar
                </Button>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/auth/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground" data-testid="register-login-link">
                    Já tenho conta
                  </Link>
                  {step < steps.length - 1 ? (
                    <Button type="button" onClick={() => validateCurrentStep() && goNext()} disabled={loading} className="bg-gradient-primary px-6" data-testid="register-next-button">
                      Continuar
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleFinish} disabled={loading} className="bg-gradient-primary px-6" data-testid="register-submit-button">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Criar conta
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
