// PF/PJ information step
'use client';
import React from 'react';
import { maskCPF, maskCNPJ, maskCEP } from '../../lib/utils';
import PhoneInput from 'react-phone-number-input';
import type { Value } from 'react-phone-number-input';

interface RegisterInfoProps {
  formData: any;
  errors: any;
  setFormData: (data: any) => void;
  accountType: 'pf' | 'pj';
  handleCPFChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCNPJChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCEPChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function RegisterInfo({
  formData,
  errors,
  setFormData,
  accountType,
  handleCPFChange,
  handleCNPJChange,
  handleCEPChange,
}: RegisterInfoProps) {
  // i18n placeholder for future translations
  // const t = (key: string) => key;
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Informações {accountType === 'pf' ? 'Pessoais' : 'da Empresa'}</h2>
      {accountType === 'pf' ? (
        <>
          <input
            placeholder="Nome Completo"
            value={formData.name || ''}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          {errors.name && <p className="text-red-500 mb-2">{errors.name}</p>}
          <input
            placeholder="CPF"
            value={maskCPF(formData.cpf || '')}
            onChange={handleCPFChange}
            className="border p-2 w-full mb-2"
            maxLength={14}
          />
          {errors.cpf && <p className="text-red-500 mb-2">{errors.cpf}</p>}
          <PhoneInput
            international
            defaultCountry="BR"
            value={formData.phone || ''}
            onChange={(phone: Value) => setFormData({ ...formData, phone })}
            className="phone-input mb-2"
          />
          {errors.phone && <p className="text-red-500 mb-2">{errors.phone}</p>}
          <input
            placeholder="Endereço"
            value={formData.address || ''}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            placeholder="Cidade"
            value={formData.city || ''}
            onChange={e => setFormData({ ...formData, city: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            placeholder="Estado"
            value={formData.state || ''}
            onChange={e => setFormData({ ...formData, state: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            placeholder="CEP"
            value={maskCEP(formData.cep || '')}
            onChange={handleCEPChange}
            className="border p-2 w-full mb-2"
            maxLength={9}
          />
          {errors.cep && <p className="text-red-500 mb-2">{errors.cep}</p>}
        </>
      ) : (
        <>
          <input
            placeholder="CNPJ"
            value={maskCNPJ(formData.cnpj || '')}
            onChange={handleCNPJChange}
            className="border p-2 w-full mb-2"
            maxLength={18}
          />
          {errors.cnpj && <p className="text-red-500 mb-2">{errors.cnpj}</p>}
          <input
            placeholder="Razão Social"
            value={formData.company || ''}
            onChange={e => setFormData({ ...formData, company: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            placeholder="Nome Fantasia"
            value={formData.tradeName || ''}
            onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <PhoneInput
            international
            defaultCountry="BR"
            value={formData.phone || ''}
            onChange={(phone: Value) => setFormData({ ...formData, phone })}
            className="phone-input mb-2"
          />
          {errors.phone && <p className="text-red-500 mb-2">{errors.phone}</p>}
          <input
            placeholder="Endereço"
            value={formData.address || ''}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            placeholder="Cidade"
            value={formData.city || ''}
            onChange={e => setFormData({ ...formData, city: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            placeholder="Estado"
            value={formData.state || ''}
            onChange={e => setFormData({ ...formData, state: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            placeholder="CEP"
            value={maskCEP(formData.cep || '')}
            onChange={handleCEPChange}
            className="border p-2 w-full mb-2"
            maxLength={9}
          />
          {errors.cep && <p className="text-red-500 mb-2">{errors.cep}</p>}
        </>
      )}
    </div>
  );
}

export default RegisterInfo;
