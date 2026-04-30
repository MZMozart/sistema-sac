"use client";
import React, { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function RegisterAddress({ formData, setFormData, onNext, onBack }: {
  formData: any,
  setFormData: (data: any) => void,
  onNext: () => void,
  onBack: () => void
}) {
  const [errors, setErrors] = useState<any>({});

  const handleCEP = async (cep: string) => {
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        setFormData({
          ...formData,
          cep,
          city: data.localidade,
          state: data.uf,
          country: "Brasil",
          street: data.logradouro,
          neighborhood: data.bairro,
        });
      } catch {}
    }
  };

  const validate = () => {
    let errs: any = {};
    if (!formData.cep || formData.cep.length !== 8) errs.cep = "CEP inválido";
    if (!formData.number) errs.number = "Número obrigatório";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  return (
    <form
      className="space-y-4"
      onSubmit={e => {
        e.preventDefault();
        if (validate()) onNext();
      }}
    >
      <div>
        <label className="block mb-1 font-medium">CEP</label>
        <Input
          type="text"
          placeholder="Digite o CEP"
          value={formData.cep || ""}
          onChange={e => {
            setFormData({ ...formData, cep: e.target.value });
            handleCEP(e.target.value);
          }}
          className="h-12 bg-secondary/50 border-border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        {errors.cep && <div className="text-red-500 text-xs mt-1">{errors.cep}</div>}
      </div>
      <div>
        <label className="block mb-1 font-medium">Rua</label>
        <Input type="text" value={formData.street || ""} disabled className="h-12 bg-secondary/30 border-border" />
      </div>
      <div>
        <label className="block mb-1 font-medium">Número</label>
        <Input
          type="text"
          placeholder="Número"
          value={formData.number || ""}
          onChange={e => setFormData({ ...formData, number: e.target.value })}
          className="h-12 bg-secondary/50 border-border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        {errors.number && <div className="text-red-500 text-xs mt-1">{errors.number}</div>}
      </div>
      <div>
        <label className="block mb-1 font-medium">Complemento</label>
        <Input
          type="text"
          placeholder="Complemento"
          value={formData.complement || ""}
          onChange={e => setFormData({ ...formData, complement: e.target.value })}
          className="h-12 bg-secondary/50 border-border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
      </div>
      <div>
        <label className="block mb-1 font-medium">Bairro</label>
        <Input type="text" value={formData.neighborhood || ""} disabled className="h-12 bg-secondary/30 border-border" />
      </div>
      <div>
        <label className="block mb-1 font-medium">Cidade</label>
        <Input type="text" value={formData.city || ""} disabled className="h-12 bg-secondary/30 border-border" />
      </div>
      <div>
        <label className="block mb-1 font-medium">Estado</label>
        <Input type="text" value={formData.state || ""} disabled className="h-12 bg-secondary/30 border-border" />
      </div>
      <div>
        <label className="block mb-1 font-medium">País</label>
        <Input type="text" value={formData.country || ""} disabled className="h-12 bg-secondary/30 border-border" />
      </div>
      <div className="flex gap-2 w-full">
        <Button variant="secondary" type="button" onClick={onBack} className="w-1/3">Voltar</Button>
        <Button variant="default" type="submit" className="w-2/3 h-12 text-base gap-3 bg-gradient-primary glow btn-press text-primary-foreground">Avançar</Button>
      </div>
    </form>
  );
}
