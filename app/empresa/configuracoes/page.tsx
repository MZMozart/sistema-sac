"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/phone-input";
import { toast } from "sonner";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function EmpresaConfiguracoesPage() {
  const { userData, company, refreshUserData } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Estados principais
  const [razaoSocial, setRazaoSocial] = useState(company?.razaoSocial || "");
  const [nomeFantasia, setNomeFantasia] = useState(company?.nomeFantasia || "");
  const [cnpj, setCnpj] = useState(company?.cnpj || "");
  const [phone, setPhone] = useState(company?.phone || "");
  const [email, setEmail] = useState(company?.email || "");
  const [segmento, setSegmento] = useState(company?.segmento || "");
  const [descricao, setDescricao] = useState(company?.descricao || "");

  useEffect(() => {
    setRazaoSocial(company?.razaoSocial || "");
    setNomeFantasia(company?.nomeFantasia || "");
    setCnpj(company?.cnpj || "");
    setPhone(company?.phone || "");
    setEmail(company?.email || "");
    setSegmento(company?.segmento || "");
    setDescricao(company?.descricao || "");
  }, [company]);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (!company) {
        toast.error("Empresa não encontrada.");
        setLoading(false);
        return;
      }
      await updateDoc(doc(db, "companies", company.id), {
        razaoSocial,
        nomeFantasia,
        cnpj,
        phone,
        email,
        segmento,
        descricao,
      });
      await refreshUserData();
      toast.success("Dados da empresa atualizados com sucesso!");
    } catch (err) {
      toast.error("Erro ao atualizar empresa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 pt-20 pb-10">
      <div className="w-full max-w-lg">
        <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in">
          <CardHeader className="text-center space-y-2 pb-2">
            <CardTitle className="text-2xl">Configurações da Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-4">
              <Input placeholder="Razão Social" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} required />
              <Input placeholder="Nome Fantasia" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} />
              <Input placeholder="CNPJ" value={cnpj} onChange={e => setCnpj(e.target.value)} />
              <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              <PhoneInput value={phone} onChange={setPhone} placeholder="Telefone comercial" />
              <Input placeholder="Segmento" value={segmento} onChange={e => setSegmento(e.target.value)} />
              <Input placeholder="Descrição" value={descricao} onChange={e => setDescricao(e.target.value)} />
              <Button type="submit" className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 glow btn-press" disabled={loading}>Salvar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
