"use client";
import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { maskCPF } from "../../lib/utils";

async function validateCPFRemote(cpf: string): Promise<{ valid: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/cpf/${cpf}`);
    const data = await res.json();
    return { valid: !!data.valid, message: data.message };
  } catch {
    return { valid: false, message: 'Erro ao validar CPF' };
  }
}

export default function RegisterCPF({ formData, setFormData, accountType, onNext, onBack }: {
  formData: any,
  setFormData: (data: any) => void,
  accountType: "pf" | "pj" | null,
  onNext: () => void,
  onBack: () => void
}) {
  const [errors, setErrors] = useState<any>({});


  // Removido preenchimento automático simulado de nome/data nascimento


  const validate = async () => {
    let errs: any = {};
    if (!formData.cpf || formData.cpf.length !== 11) {
      errs.cpf = "CPF inválido";
    } else {
      const result = await validateCPFRemote(formData.cpf);
      if (!result.valid) errs.cpf = result.message || "CPF inválido";
    }
    if (!formData.birthdate) errs.birthdate = "Data de nascimento obrigatória";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  return (
    <form
      className="space-y-4"
      onSubmit={async e => {
        e.preventDefault();
        if (await validate()) onNext();
      }}
    >
      <div>
        <label className="block mb-1 font-medium">CPF</label>
        <Input
          type="text"
          placeholder="CPF"
          value={maskCPF(formData.cpf || "")}
          maxLength={14}
          onChange={e => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, "") })}
          className="h-12 bg-secondary/50 border-border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        {errors.cpf && <div className="text-red-500 text-xs mt-1">{errors.cpf}</div>}
      </div>
      <div>
        <label className="block mb-1 font-medium">Data de nascimento</label>
        <input
          className="input glass-card w-full"
          type="date"
          value={formData.birthdate || ""}
          onChange={e => setFormData({ ...formData, birthdate: e.target.value })}
        />
        {errors.birthdate && <div className="text-red-500 text-xs mt-1">{errors.birthdate}</div>}
      </div>
      <div className="flex gap-2 w-full">
        <Button variant="secondary" type="button" onClick={onBack} className="w-1/3">Voltar</Button>
        <Button variant="default" type="submit" className="w-2/3 h-12 text-base gap-3 bg-gradient-primary glow btn-press text-primary-foreground">Avançar</Button>
      </div>
    </form>
  );
}
