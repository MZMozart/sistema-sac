// Zod schemas for PF/PJ registration

import { z } from "zod";

export const registerPFSchema = z.object({
  name: z.string().min(3,"Nome muito curto"),
  email: z.string().email("Email inválido"),
  cpf: z.string().min(11,"CPF inválido"),
  phone: z.string().min(10,"Telefone inválido"),
  password: z.string().min(6,"Senha deve ter 6 caracteres")
});

export type RegisterPFData = z.infer<typeof registerPFSchema>;

export const registerPJSchema = z.object({
  company: z.string().min(3),
  cnpj: z.string().min(14),
  email: z.string().email(),
  password: z.string().min(6)
});

export type RegisterPJData = z.infer<typeof registerPJSchema>;
