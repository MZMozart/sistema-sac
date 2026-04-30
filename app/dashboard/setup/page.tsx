"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { PhoneInput, type Country } from "@/components/phone-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Building2, Loader2, Search, CheckCircle2, ArrowRight } from "lucide-react";
import type { CNPJData, Company } from "@/lib/types";

type SetupStep = "company" | "details" | "complete";

export default function SetupPage() {
  const router = useRouter();
  const { user, userData, refreshUserData } = useAuth();

  const [step, setStep] = useState<SetupStep>("company");
  const [loading, setLoading] = useState(false);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [companyData, setCompanyData] = useState({
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    phone: "",
    fullPhone: "",
    phoneCountry: null as Country | null,
    segmento: "",
    descricao: "",
  });
  const [cnpjData, setCNPJData] = useState<CNPJData | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
    }
  }, [user, router]);

  function formatCNPJ(cnpj: string) {
    return cnpj
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18);
  }

  function handlePhoneChange(value: string, fullNumber: string, country: Country) {
    setCompanyData({
      ...companyData,
      phone: value,
      fullPhone: fullNumber,
      phoneCountry: country,
    });
  }

  async function fetchCNPJ() {
    if (!companyData.cnpj || companyData.cnpj.replace(/\D/g, "").length !== 14) {
      toast.error("CNPJ invalido");
      return;
    }
    setLoadingCNPJ(true);
    try {
      const cnpj = companyData.cnpj.replace(/\D/g, "");
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      setCompanyData((prev) => ({
        ...prev,
        razaoSocial: data.razao_social || prev.razaoSocial,
        nomeFantasia: data.nome_fantasia || data.fantasia || prev.nomeFantasia,
        phone: prev.phone || (data.telefone ? data.telefone.replace(/\D/g, "") : ""),
      }));
      setCNPJData(data);
      toast.success("Dados do CNPJ buscados com sucesso!");
    } catch (error) {
      toast.error("Erro ao buscar CNPJ");
    } finally {
      setLoadingCNPJ(false);
    }
  }

  async function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyData.razaoSocial || !companyData.phone) {
      toast.error("Preencha os campos obrigatorios");
      return;
    }
    setStep("details");
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Voce precisa estar logado");
      return;
    }
    setLoading(true);
    try {
      const companyId = user.uid + "_company";
      const newCompany: Partial<Company> = {
        id: companyId,
        ownerId: user.uid,
        cnpj: companyData.cnpj.replace(/\D/g, ""),
        razaoSocial: companyData.razaoSocial,
        nomeFantasia: companyData.nomeFantasia || companyData.razaoSocial,
        phone: companyData.fullPhone,
        descricao: companyData.descricao,
        createdAt: new Date(),
        isActive: true,
      };
      console.log("[Cadastro] Criando empresa:", newCompany);
      await setDoc(doc(db, "companies", companyId), {
        ...newCompany,
        createdAt: serverTimestamp(),
      });
      console.log("[Cadastro] Empresa criada com ID:", companyId);
      await updateDoc(doc(db, "users", user.uid), {
        companyId: companyId,
        razaoSocial: companyData.razaoSocial,
        nomeFantasia: companyData.nomeFantasia,
        cnpj: companyData.cnpj.replace(/\D/g, ""),
        phone: companyData.fullPhone,
        descricao: companyData.descricao,
      });
      console.log("[Cadastro] Usuario atualizado:", user.uid);
      await setDoc(doc(db, "employees", `${companyId}_${user.uid}`), {
        id: `${companyId}_${user.uid}`,
        companyId: companyId,
        userId: user.uid,
        email: user.email,
        name: user.displayName || userData?.fullName || "Proprietario",
        role: "owner",
        isActive: true,
        createdAt: serverTimestamp(),
      });
      console.log("[Cadastro] Funcionário criado:", `${companyId}_${user.uid}`);
      await refreshUserData();
      setStep("complete");
      toast.success("Empresa configurada com sucesso!");
    } catch (error) {
      console.error("[Cadastro] Erro ao configurar empresa:", error);
      toast.error("Erro ao configurar empresa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 pt-20 pb-10">
      <div className="w-full max-w-lg">
        {step === "company" && (
          <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in">
            <CardHeader className="text-center space-y-2 pb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center mx-auto glow">
                <Building2 className="w-6 h-6 text-accent-foreground" />
              </div>
              <CardTitle className="text-2xl">Configure sua Empresa</CardTitle>
              <CardDescription>
                Preencha os dados da sua empresa para comecar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">CNPJ (opcional)</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="00.000.000/0000-00"
                      value={companyData.cnpj}
                      onChange={(e) => setCompanyData({ ...companyData, cnpj: formatCNPJ(e.target.value) })}
                      maxLength={18}
                      className="h-12 bg-secondary/50 border-border focus-ring"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchCNPJ}
                      disabled={loadingCNPJ || companyData.cnpj.replace(/\D/g, "").length !== 14}
                      className="h-12 px-4 shrink-0"
                    >
                      {loadingCNPJ ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Preencha para buscar dados automaticamente
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Razao Social *</label>
                  <Input
                    placeholder="Nome da empresa"
                    value={companyData.razaoSocial}
                    onChange={(e) => setCompanyData({ ...companyData, razaoSocial: e.target.value })}
                    className="h-12 bg-secondary/50 border-border focus-ring"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome Fantasia</label>
                  <Input
                    placeholder="Como seus clientes conhecem"
                    value={companyData.nomeFantasia}
                    onChange={(e) => setCompanyData({ ...companyData, nomeFantasia: e.target.value })}
                    className="h-12 bg-secondary/50 border-border focus-ring"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone da Empresa *</label>
                  <PhoneInput
                    value={companyData.phone}
                    onChange={handlePhoneChange}
                    placeholder="Telefone comercial"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 glow btn-press"
                >
                  Continuar
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        {step === "details" && (
          <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in">
            <CardHeader className="text-center space-y-2 pb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center mx-auto glow">
                <Building2 className="w-6 h-6 text-accent-foreground" />
              </div>
              <CardTitle className="text-2xl">Detalhes do Negocio</CardTitle>
              <CardDescription>
                Conte mais sobre sua empresa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDetailsSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Segmento de Atuacao</label>
                  <Input
                    placeholder="Ex: Tecnologia, Comercio, Servicos..."
                    value={companyData.segmento}
                    onChange={(e) => setCompanyData({ ...companyData, segmento: e.target.value })}
                    className="h-12 bg-secondary/50 border-border focus-ring"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descricao da Empresa</label>
                  <textarea
                    placeholder="Descreva brevemente sua empresa e seus servicos..."
                    value={companyData.descricao}
                    onChange={(e) => setCompanyData({ ...companyData, descricao: e.target.value })}
                    className="w-full min-h-[100px] p-3 rounded-lg bg-secondary/50 border border-border focus-ring resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 glow btn-press"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Configurando...
                    </>
                  ) : (
                    <>
                      Finalizar Configuracao
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        {step === "complete" && (
          <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in">
            <CardContent className="pt-8 pb-6 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Tudo Pronto!</h2>
                <p className="text-muted-foreground">
                  Sua empresa foi configurada com sucesso. Agora voce pode comecar a atender seus clientes.
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/dashboard")}
                  className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 glow btn-press"
                >
                  Ir para o Dashboard
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/dashboard/bot")}
                  className="w-full h-12"
                >
                  Configurar BOT de Atendimento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
