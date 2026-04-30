// Modular PF registration form
'use client';


import { useState } from "react";

import RegisterAccount from "./RegisterAccount";
import RegisterCPF from "./RegisterCPF";
import RegisterProfile from "./RegisterProfile";
import RegisterAddress from "./RegisterAddress";
import RegisterPhone from "./RegisterPhone";
import RegisterDocuments from "./RegisterDocuments";
import RegisterComplete from "./RegisterComplete";
import { useEffect } from "react";


export default function RegisterPF({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<any>({});

  // Step 0: Email/Senha
  // Step 1: CPF (auto-fill name/birthdate)
  // Step 2: Profile (name/birthdate editable)
  // Step 3: Address
  // Step 4: Phone
  // Step 5: Documents
  // Step 6: Complete

  // When CPF is filled and valid, fetch name/birthdate (simulate API or use real API if available)
  useEffect(() => {
    async function fetchCPFData() {
      if (formData.cpf && formData.cpf.length === 11 && (!formData.name || !formData.birthdate)) {
        // Try BrasilAPI for CPF (if available), else mock
        try {
          // Example: const res = await fetch(`/api/cpf/${formData.cpf}`);
          // const data = await res.json();
          // setFormData((prev: any) => ({ ...prev, name: data.name, birthdate: data.birthdate }));
          // For now, mock:
          setTimeout(() => {
            setFormData((prev: any) => ({
              ...prev,
              name: "Cliente Teste",
              birthdate: "1990-01-01"
            }));
          }, 800);
        } catch {
          // fallback: do nothing
        }
      }
    }
    if (step === 1) fetchCPFData();
  }, [formData.cpf, step]);

  const steps = [
    <RegisterAccount
      key="account"
      formData={formData}
      errors={errors}
      setFormData={setFormData}
      accountType="pf"
      onNext={() => setStep(1)}
    />,
    <RegisterCPF
      key="cpf"
      formData={formData}
      setFormData={setFormData}
      accountType="pf"
      onNext={() => setStep(2)}
      onBack={onBack}
    />,
    <RegisterProfile
      key="profile"
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      accountType="pf"
      handleCPFChange={() => {}}
      handleCNPJChange={() => {}}
      onNext={() => {
        // Validação obrigatória do nome completo e data de nascimento
        const newErrors: any = {};
        if (!formData.name || formData.name.trim().length < 3) newErrors.name = "Nome completo obrigatório";
        if (!formData.birthdate) newErrors.birthdate = "Data de nascimento obrigatória";
        setErrors(newErrors);
        if (Object.keys(newErrors).length === 0) setStep(3);
      }}
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
        window.location.href = "/cliente/dashboard";
      }
    }} />
  ];

  return (
    <div className="w-full max-w-md mx-auto">
      {steps[step]}
    </div>
  );
}
