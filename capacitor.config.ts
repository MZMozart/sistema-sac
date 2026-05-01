import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'br.com.atendepro.app',
  appName: 'AtendePro',
  webDir: 'public',
  server: {
    url: 'https://atendepro-tcc.vercel.app/auth/login',
    cleartext: false,
  },
  android: {
    path: 'android',
    adjustMarginsForEdgeToEdge: 'force',
    backgroundColor: '#050b17',
  },
}

export default config
