import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'br.com.atendepro.app',
  appName: 'AtendePro',
  webDir: 'public',
  server: {
    url: 'https://atendepro-tcc.vercel.app',
    cleartext: false,
  },
  android: {
    path: 'android',
  },
}

export default config

