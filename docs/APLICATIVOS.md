# Aplicativos AtendePro

## Windows

O instalador desktop e gerado com Electron:

```bash
npm run desktop:build:win
```

Saida local:

```text
dist-desktop/AtendePro-0.1.0-win-x64.exe
```

O app instalado abre a versao de producao:

```text
https://atendepro-tcc.vercel.app
```

## Android

O projeto Android usa Capacitor e empacota o AtendePro como aplicativo nativo que abre a versao de producao.

Comandos:

```bash
npm run android:sync
npm run android:build:debug
```

Saida esperada:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Para build local do APK, o computador precisa de Java 11+ e Android SDK. O workflow do GitHub em `.github/workflows/build-apps.yml` ja prepara Java 17 e gera o APK como artifact.

## Celular sem APK

O site tambem continua instalavel como PWA em Android:

1. Abrir `https://atendepro-tcc.vercel.app` no Chrome.
2. Tocar no menu do navegador.
3. Escolher `Instalar app` ou `Adicionar a tela inicial`.

