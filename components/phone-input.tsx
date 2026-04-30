'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Phone } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Country {
  code: string
  name: string
  dialCode: string
  flag: string
  format: string
  maxLength: number
}

const countries: Country[] = [
  { code: 'BR', name: 'Brasil', dialCode: '+55', flag: '🇧🇷', format: '(##) #####-####', maxLength: 11 },
  { code: 'US', name: 'Estados Unidos', dialCode: '+1', flag: '🇺🇸', format: '(###) ###-####', maxLength: 10 },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', format: '### ### ###', maxLength: 9 },
  { code: 'ES', name: 'Espanha', dialCode: '+34', flag: '🇪🇸', format: '### ## ## ##', maxLength: 9 },
  { code: 'FR', name: 'França', dialCode: '+33', flag: '🇫🇷', format: '# ## ## ## ##', maxLength: 9 },
  { code: 'DE', name: 'Alemanha', dialCode: '+49', flag: '🇩🇪', format: '### #######', maxLength: 11 },
  { code: 'IT', name: 'Itália', dialCode: '+39', flag: '🇮🇹', format: '### ### ####', maxLength: 10 },
  { code: 'GB', name: 'Reino Unido', dialCode: '+44', flag: '🇬🇧', format: '#### ######', maxLength: 10 },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', format: '## ####-####', maxLength: 10 },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱', format: '# #### ####', maxLength: 9 },
  { code: 'CO', name: 'Colômbia', dialCode: '+57', flag: '🇨🇴', format: '### ### ####', maxLength: 10 },
  { code: 'MX', name: 'México', dialCode: '+52', flag: '🇲🇽', format: '## #### ####', maxLength: 10 },
  { code: 'PE', name: 'Peru', dialCode: '+51', flag: '🇵🇪', format: '### ### ###', maxLength: 9 },
  { code: 'UY', name: 'Uruguai', dialCode: '+598', flag: '🇺🇾', format: '## ### ###', maxLength: 8 },
  { code: 'PY', name: 'Paraguai', dialCode: '+595', flag: '🇵🇾', format: '### ### ###', maxLength: 9 },
  { code: 'BO', name: 'Bolívia', dialCode: '+591', flag: '🇧🇴', format: '# ### ####', maxLength: 8 },
  { code: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪', format: '### ### ####', maxLength: 10 },
  { code: 'EC', name: 'Equador', dialCode: '+593', flag: '🇪🇨', format: '## ### ####', maxLength: 9 },
  { code: 'CA', name: 'Canadá', dialCode: '+1', flag: '🇨🇦', format: '(###) ###-####', maxLength: 10 },
  { code: 'AU', name: 'Austrália', dialCode: '+61', flag: '🇦🇺', format: '### ### ###', maxLength: 9 },
  { code: 'JP', name: 'Japão', dialCode: '+81', flag: '🇯🇵', format: '##-####-####', maxLength: 10 },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', format: '### #### ####', maxLength: 11 },
  { code: 'IN', name: 'Índia', dialCode: '+91', flag: '🇮🇳', format: '##### #####', maxLength: 10 },
  { code: 'RU', name: 'Rússia', dialCode: '+7', flag: '🇷🇺', format: '### ###-##-##', maxLength: 10 },
  { code: 'ZA', name: 'África do Sul', dialCode: '+27', flag: '🇿🇦', format: '## ### ####', maxLength: 9 },
  { code: 'AE', name: 'Emirados Árabes', dialCode: '+971', flag: '🇦🇪', format: '## ### ####', maxLength: 9 },
  { code: 'SA', name: 'Arábia Saudita', dialCode: '+966', flag: '🇸🇦', format: '## ### ####', maxLength: 9 },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱', format: '##-###-####', maxLength: 9 },
  { code: 'KR', name: 'Coreia do Sul', dialCode: '+82', flag: '🇰🇷', format: '##-####-####', maxLength: 10 },
  { code: 'SG', name: 'Singapura', dialCode: '+65', flag: '🇸🇬', format: '#### ####', maxLength: 8 },
  { code: 'NZ', name: 'Nova Zelândia', dialCode: '+64', flag: '🇳🇿', format: '## ### ####', maxLength: 9 },
  { code: 'IE', name: 'Irlanda', dialCode: '+353', flag: '🇮🇪', format: '## ### ####', maxLength: 9 },
  { code: 'NL', name: 'Holanda', dialCode: '+31', flag: '🇳🇱', format: '# #### ####', maxLength: 9 },
  { code: 'BE', name: 'Bélgica', dialCode: '+32', flag: '🇧🇪', format: '### ## ## ##', maxLength: 9 },
  { code: 'CH', name: 'Suíça', dialCode: '+41', flag: '🇨🇭', format: '## ### ## ##', maxLength: 9 },
  { code: 'AT', name: 'Áustria', dialCode: '+43', flag: '🇦🇹', format: '### ### ####', maxLength: 10 },
  { code: 'SE', name: 'Suécia', dialCode: '+46', flag: '🇸🇪', format: '##-### ## ##', maxLength: 9 },
  { code: 'NO', name: 'Noruega', dialCode: '+47', flag: '🇳🇴', format: '### ## ###', maxLength: 8 },
  { code: 'DK', name: 'Dinamarca', dialCode: '+45', flag: '🇩🇰', format: '## ## ## ##', maxLength: 8 },
  { code: 'FI', name: 'Finlândia', dialCode: '+358', flag: '🇫🇮', format: '## ### ####', maxLength: 9 },
  { code: 'PL', name: 'Polônia', dialCode: '+48', flag: '🇵🇱', format: '### ### ###', maxLength: 9 },
  { code: 'CZ', name: 'República Tcheca', dialCode: '+420', flag: '🇨🇿', format: '### ### ###', maxLength: 9 },
  { code: 'GR', name: 'Grécia', dialCode: '+30', flag: '🇬🇷', format: '### ### ####', maxLength: 10 },
  { code: 'TR', name: 'Turquia', dialCode: '+90', flag: '🇹🇷', format: '### ### ## ##', maxLength: 10 },
  { code: 'EG', name: 'Egito', dialCode: '+20', flag: '🇪🇬', format: '### ### ####', maxLength: 10 },
  { code: 'NG', name: 'Nigéria', dialCode: '+234', flag: '🇳🇬', format: '### ### ####', maxLength: 10 },
  { code: 'KE', name: 'Quênia', dialCode: '+254', flag: '🇰🇪', format: '### ### ###', maxLength: 9 },
  { code: 'MA', name: 'Marrocos', dialCode: '+212', flag: '🇲🇦', format: '### ## ## ##', maxLength: 9 },
  { code: 'TH', name: 'Tailândia', dialCode: '+66', flag: '🇹🇭', format: '## ### ####', maxLength: 9 },
  { code: 'VN', name: 'Vietnã', dialCode: '+84', flag: '🇻🇳', format: '### ### ####', maxLength: 10 },
  { code: 'PH', name: 'Filipinas', dialCode: '+63', flag: '🇵🇭', format: '### ### ####', maxLength: 10 },
  { code: 'MY', name: 'Malásia', dialCode: '+60', flag: '🇲🇾', format: '##-### ####', maxLength: 9 },
  { code: 'ID', name: 'Indonésia', dialCode: '+62', flag: '🇮🇩', format: '### ### ####', maxLength: 10 },
  { code: 'PK', name: 'Paquistão', dialCode: '+92', flag: '🇵🇰', format: '### ### ####', maxLength: 10 },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', format: '#### ### ###', maxLength: 10 },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', format: '#### ####', maxLength: 8 },
  { code: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼', format: '### ### ###', maxLength: 9 },
]

interface PhoneInputProps {
  value: string
  onChange: (value: string, fullNumber: string, country: Country) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function PhoneInput({ value, onChange, disabled, className, placeholder }: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0])
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(value)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter countries based on search
  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.dialCode.includes(search) ||
      country.code.toLowerCase().includes(search.toLowerCase())
  )

  // Format phone number based on country format
  const formatPhoneNumber = (number: string, country: Country) => {
    const digits = number.replace(/\D/g, '').slice(0, country.maxLength)
    let formatted = ''
    let digitIndex = 0

    for (let i = 0; i < country.format.length && digitIndex < digits.length; i++) {
      if (country.format[i] === '#') {
        formatted += digits[digitIndex]
        digitIndex++
      } else {
        formatted += country.format[i]
        if (digitIndex < digits.length && country.format[i + 1] === '#') {
          // Continue
        }
      }
    }

    return formatted
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const formatted = formatPhoneNumber(rawValue, selectedCountry)
    setPhoneNumber(formatted)
    onChange(formatted, `${selectedCountry.dialCode}${rawValue}`, selectedCountry)
  }

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country)
    setIsOpen(false)
    setSearch('')
    // Reformat the number with the new country format
    const rawValue = phoneNumber.replace(/\D/g, '')
    const formatted = formatPhoneNumber(rawValue, country)
    setPhoneNumber(formatted)
    onChange(formatted, `${country.dialCode}${rawValue}`, country)
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <div className="flex items-center">
        {/* Country Selector */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 h-12 px-3 rounded-l-lg border border-r-0 border-border bg-secondary/50 hover:bg-secondary transition-colors',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className="text-xl" role="img" aria-label={selectedCountry.name}>
            {selectedCountry.flag}
          </span>
          <span className="text-sm font-medium text-foreground min-w-[45px] text-left">
            {selectedCountry.dialCode}
          </span>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
        </button>

        {/* Phone Input */}
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="tel"
            placeholder={placeholder || selectedCountry.format.replace(/#/g, '0')}
            value={phoneNumber}
            onChange={handlePhoneChange}
            disabled={disabled}
            className="pl-10 h-12 rounded-l-none bg-secondary/50 border-border focus-ring"
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full max-h-72 overflow-hidden rounded-lg border border-border bg-card shadow-xl animate-fade-in">
          {/* Search */}
          <div className="sticky top-0 p-2 bg-card border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar país..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-secondary/50 border-border"
                autoFocus
              />
            </div>
          </div>

          {/* Country List */}
          <div className="overflow-y-auto max-h-56">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhum país encontrado</div>
            ) : (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleCountrySelect(country)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/80 transition-colors text-left',
                    selectedCountry.code === country.code && 'bg-primary/10'
                  )}
                >
                  <span className="text-xl" role="img" aria-label={country.name}>
                    {country.flag}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">{country.name}</span>
                  <span className="text-sm text-muted-foreground">{country.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { countries, type Country }
