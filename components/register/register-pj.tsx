// Modular PJ registration form
'use client';


import { useState, useEffect } from "react";
import RegisterAccount from "./RegisterAccount";
import RegisterCNPJ from "./RegisterCNPJ";
import RegisterCNPJResult from "./RegisterCNPJResult";
import RegisterAddress from "./RegisterAddress";
import RegisterPhone from "./RegisterPhone";
import RegisterDocuments from "./RegisterDocuments";
import RegisterComplete from "./RegisterComplete";

export default function RegisterPJ({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<any>({});

  // Step 0: Email/Senha (with Google)
  // Step 1: CNPJ (auto-fill)
  // Step 2: Confirm company data
  // Step 3: Address (pre-filled if possible)
  // Step 4: Phone
  // Step 5: Documents
  // Step 6: Complete

  // When CNPJ is filled and valid, fetch company data
  useEffect(() => {
    async function fetchCNPJData() {
      if (formData.cnpj && formData.cnpj.length === 14) {
        try {
          const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${formData.cnpj}`);
          if (res.ok) {
            const data = await res.json();
            setFormData((prev: any) => ({
              ...prev,
              cnpj: formData.cnpj,
              company: data.razao_social || '',
              tradeName: data.nome_fantasia || data.fantasia || '',
              name: data.qsa && data.qsa[0] && data.qsa[0].nome_socio ? data.qsa[0].nome_socio : '',
              address: `${data.logradouro}, ${data.numero} ${data.complemento}`,
              city: data.municipio,
              state: data.uf,
              cep: data.cep,
            }));
          }
        } catch {}
      }
    }
    if (step === 1) fetchCNPJData();
  }, [formData.cnpj, step]);

  const steps = [
    <RegisterAccount
      key="account"
      formData={formData}
      errors={errors}
      setFormData={setFormData}
      accountType="pj"
      onGoogleSignup={() => setStep(1)}
      onNext={() => setStep(1)}
    />,
    <RegisterCNPJ
      key="cnpj"
      formData={formData}
      setFormData={setFormData}
      onNext={() => setStep(2)}
      onBack={onBack}
    />,
    <RegisterCNPJResult
      key="cnpjresult"
      formData={formData}
      setFormData={setFormData}
      onNext={() => setStep(3)}
      onBack={() => setStep(1)}
    />,
    <RegisterAddress
      key="address"
      formData={formData}
      setFormData={setFormData}
      onNext={() => setStep(4)}
      onBack={() => setStep(2)}
    />,
    <RegisterPhone
      key="phone"
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      onNext={() => setStep(5)}
    />,
    <RegisterDocuments
      key="docs"
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      onUpload={() => {}}
      onNext={() => setStep(6)}
    />,
    <RegisterComplete key="done" onFinish={() => {
      if (typeof window !== "undefined") {
        window.location.href = "/empresa/dashboard";
      }
    }} />
  ];

  return (
    <div className="w-full max-w-md mx-auto">
      {steps[step]}
    </div>
  );
}
