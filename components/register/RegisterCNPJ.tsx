"use client";
import React, { useState } from "react";
import RegisterCNPJResult from "./RegisterCNPJResult";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { validateCNPJ } from "../../lib/cnpj";
import { maskCNPJ } from "../../lib/utils";

async function validateCNPJRemote(cnpj: string): Promise<{ valid: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/cnpj/${cnpj}`);
    const data = await res.json();
    if (data.error) return { valid: false, message: data.error };
    return { valid: true };
  } catch {
    return { valid: false, message: 'Erro ao validar CNPJ' };
  }
}

export default function RegisterCNPJ({ formData, setFormData, onNext, onBack }: {
  formData: any,
  setFormData: (data: any) => void,
  onNext: () => void,
  onBack: () => void
}) {
  const [errors, setErrors] = useState<any>({});
  const [showResult, setShowResult] = useState(false);

  const handleCNPJ = async (cnpj: string) => {
    setFormData({ ...formData, cnpj });
    if (cnpj.length === 14 && validateCNPJ(cnpj)) {
      const valid = await validateCNPJRemote(cnpj);
      if (!valid.valid) {
        setErrors({ cnpj: valid.message || "CNPJ inválido" });
        return;
      }
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        if (res.ok) {
          const data = await res.json();
          setFormData({
            ...formData,
            cnpj,
            company: data.razao_social || '',
            tradeName: data.nome_fantasia || data.fantasia || '',
            name: data.qsa && data.qsa[0] && data.qsa[0].nome_socio ? data.qsa[0].nome_socio : '',
            address: `${data.logradouro}, ${data.numero} ${data.complemento}`,
            city: data.municipio,
            state: data.uf,
            cep: data.cep,
          });
          // Mostra tela de confirmação imediatamente
          setShowResult(true);
        } else {
          setErrors({ cnpj: "CNPJ não encontrado" });
        }
      } catch {
        setErrors({ cnpj: "Erro ao buscar CNPJ" });
      }
    }
  };

  const validate = () => {
    let errs: any = {};
    if (!formData.cnpj || !validateCNPJ(formData.cnpj)) errs.cnpj = "CNPJ inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  if (showResult) {
    return <RegisterCNPJResult formData={formData} setFormData={setFormData} onNext={() => {
      setShowResult(false);
      onNext();
    }} onBack={() => setShowResult(false)} />;
  }
  return (
    <form
      className="space-y-6 w-full"
      onSubmit={e => {
        e.preventDefault();
        if (validate()) setShowResult(true);
      }}
    >
      <div className="space-y-2">
        <label className="block mb-1 font-medium">CNPJ</label>
        <Input
          type="text"
          placeholder="00.000.000/0000-00"
          value={maskCNPJ(formData.cnpj || "")}
          maxLength={18}
          onChange={e => handleCNPJ(e.target.value.replace(/\D/g, ""))}
          className={
            "h-12 bg-secondary/50 border-border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" +
            (errors.cnpj ? " border-red-500" : "")
          }
          autoFocus
        />
        {errors.cnpj && <div className="text-red-500 text-xs mt-1">{errors.cnpj}</div>}
      </div>
      <div className="flex gap-2 w-full">
        <Button variant="secondary" type="button" onClick={onBack} className="w-1/3">Voltar</Button>
        <Button variant="default" type="submit" className="w-2/3 h-12 text-base gap-3 bg-gradient-primary glow btn-press text-primary-foreground">Avançar</Button>
      </div>
    </form>
  );
}
