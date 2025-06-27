
# 📸 Conversor de Arquivos Serverless

---

## ✨ Visão Geral do Projeto

Este projeto demonstra um sistema de conversão de arquivos (imagens e PDFs, inicialmente) utilizando uma arquitetura **serverless** com **Firebase Functions** e **Firebase Storage**. O objetivo é permitir o processamento de arquivos sob demanda, disparado por eventos de upload.

---

## 🚀 Arquitetura da Aplicação

A arquitetura é composta por um frontend simples e pelos serviços gerenciados do Google Firebase, atuando como um backend serverless, eliminando a necessidade de gerenciar servidores.

**Fluxo de Dados:**
`Usuário no Navegador` → `Seleciona Arquivo e Ação` → `Frontend faz Upload para Storage` → `Upload Dispara Cloud Function` → `Cloud Function Processa o Arquivo` → `Cloud Function Salva Resultado no Storage` → `Cloud Function Atualiza Firestore com Link` → `Frontend Escuta Firestore e Exibe Link`.


![image](https://github.com/user-attachments/assets/2dd3b59a-4bb3-44f3-a070-94bae5011dc3)


### Componentes:

* **Frontend (HTML, CSS, JS)**: Uma interface web intuitiva que permite ao usuário selecionar um arquivo, escolher o tipo de processamento (redimensionar, P&B, imagem para PDF) e visualizar o link para o resultado.
* **Firebase Storage**: Serviço de armazenamento de objetos altamente escalável, usado para guardar os arquivos originais (na pasta `uploads/`) e os arquivos processados (na pasta `processed/`). O upload inicial do frontend aciona o fluxo serverless.
* **Firebase Functions**: A função `processImage` é o coração serverless da aplicação. Ela é acionada por eventos de upload no Storage, executa a lógica de processamento do arquivo e coordena o salvamento do resultado.
* **Cloud Firestore**: Banco de dados NoSQL flexível, usado para armazenar metadados sobre os arquivos processados. O frontend "escuta" o Firestore em tempo real para exibir o link de download do arquivo convertido assim que ele está pronto.

---

## 🛠️ Tecnologias Utilizadas

Para consultar as versões exatas, verifique os arquivos `package.json` (na raiz e em `functions/`). As versões abaixo são as utilizadas e recomendadas.

| Tecnologia            | Versão Testada | Descrição                                                                         |
| :-------------------- | :------------- | :---------------------------------------------------------------------------------- |
| **Node.js** | v20+           | Ambiente de execução JavaScript para as Firebase Functions.                         |
| **npm** | Qualquer recente | Gerenciador de pacotes para dependências.                                       |
| **Git** | Qualquer recente | Sistema de controle de versão.                                                  |
| **Firebase CLI** | Qualquer recente | Ferramenta de linha de comando para interagir com o Firebase.                      |
| **Firebase Functions**| v4.9.0+        | Framework para construir e implantar código serverless no Firebase.                 |
| **Firebase Admin SDK**| ^12.6.0        | SDK para gerenciar serviços do Firebase (Storage, Firestore) no backend.            |
| **Firebase Client SDK**| v9 (modular)   | SDK para interagir com os serviços do Firebase no frontend.                         |
| **`sharp`** | ^0.34.2        | Biblioteca Node.js de alta performance para processamento de imagens (redimensionar, P&B). |
| **`pdf-lib`** | Qualquer recente | Biblioteca Node.js para criar e manipular documentos PDF (usada para converter imagem para PDF). |

---

## ⚙️ Como Executar o Projeto

### ✅ Pré-requisitos

Certifique-se de ter instalado em sua máquina:

* **Node.js e npm**: Tenha o [Node.js](https://nodejs.org/) (versão 20 LTS recomendada) e o npm instalados.
* **Git**: Para clonar o repositório.
* **Firebase CLI**: Instale globalmente via npm:
    ```bash
    npm install -g firebase-tools
    ```
* Uma **Conta Google** e um **Projeto Firebase** configurado.

---

### 1. Clonar o Repositório

Primeiro, clone o projeto para sua máquina local e navegue até o diretório raiz:

```bash
git clone https://github.com/LucasCleiton/serverless-image-converter
cd serverless-image-converter
````



### 2\. Configurar o Projeto Firebase

1.  **Crie ou selecione um projeto Firebase** no [Console do Firebase](https://console.firebase.google.com/).
2.  **Habilite os seguintes serviços** no seu projeto Firebase (na seção `Build`):
      * **Cloud Firestore**: Vá em `Firestore Database > Create Database`. Escolha `Start in production mode` e uma localização.
      * **Storage**: Vá em `Storage > Get Started`.
      * **Functions**: Certifique-se de que o serviço está habilitado.
3.  **Associe seu projeto local ao Firebase CLI**: Na **raiz do seu projeto** no terminal, execute:
    ```bash
    firebase login # Se ainda não estiver logado na sua conta Google
    firebase use --add # Selecione o projeto Firebase que você criou/selecionou
    ```
4.  **Inicialize as funcionalidades do Firebase**:
    ```bash
    firebase init
    ```
      * Quando perguntado:
          * `Which Firebase features do you want to set up?`: Selecione `Functions`, `Hosting` e `Storage`.
          * `Please select an option:`: Escolha `Use an existing project` e selecione o seu projeto Firebase.
          * Para **Functions**: escolha `JavaScript`, use `ESLint (Yes)`, e instale as dependências com `npm (Yes)`.
          * Para **Hosting**: use `public` como diretório público, e configure como "single-page app (Yes)".
          * Para **Storage**: use `storage.rules` como arquivo de regras.

-----

### 3\. Instalar Dependências das Funções

As Cloud Functions têm suas próprias dependências. Navegue até a pasta `functions` e instale-as:

```bash
cd functions
# Para uma instalação limpa (recomendado se houver problemas):
# rmdir /s /q node_modules # No Windows PowerShell/CMD
# del package-lock.json    # No Windows PowerShell/CMD
# npm cache clean --force  # Limpa o cache do npm
npm install                # Instala todas as dependências (sharp, pdf-lib, etc.)
cd .. # Volte para a raiz do projeto
```

-----

### 4\. Configurar Regras de Segurança (Firestore e Storage)

É **fundamental** que o frontend e a função tenham as permissões corretas para acessar os serviços do Firebase. No [Console do Firebase](https://console.firebase.google.com/):

1.  **Firebase Storage Rules**: Acesse `Build > Storage > Rules`. Cole as regras a seguir e clique em **Publicar**:
    ```firebase
    rules_version = '2';
    service firebase.storage {
      match /b/{bucket}/o {
        match /uploads/{file} {
          allow write: if true; // Permite uploads anônimos do frontend
          allow read: if true;  // Permite leitura dos originais
        }
        match /processed/{file} {
          allow read: if true; // Permite leitura dos arquivos processados pelo link
        }
        // Regra padrão para outras áreas do Storage (ajuste se tiver outros usos)
        match /{allPaths=**} {
          allow read, write: if request.auth != null; // Requer autenticação para outras pastas
        }
      }
    }
    ```
2.  **Cloud Firestore Rules**: Acesse `Build > Firestore Database > Rules`. Cole as regras a seguir e clique em **Publicar**:
    ```firebase
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /processedFiles/{documentId} {
          allow read: if true; // Permite leitura pública da coleção pelo frontend
          allow write: if false; // A escrita é feita apenas pela Cloud Function (Admin SDK)
        }
        // Regra padrão para outras coleções (nega acesso por padrão)
        match /{document=**} {
          allow read, write: if false;
        }
      }
    }
    ```
3.  **Permissão para Geração de URL (IAM)**: A conta de serviço padrão do seu projeto (geralmente `[ID_DO_PROJETO]@appspot.gserviceaccount.com`) precisa da permissão para gerar URLs assinadas.
      * No [Console do Google Cloud](https://console.cloud.google.com/), navegue até `IAM e Administrador > IAM`.
      * Procure pela sua conta de serviço `@appspot.gserviceaccount.com`.
      * Clique no ícone de lápis (Editar principal) e adicione o papel **"Criador de tokens da conta de serviço"**. Salve.

-----

### 5\. Fazer Deploy para o Firebase

Após todas as configurações, é hora de enviar seu projeto para a nuvem.

```bash
# Na raiz do projeto
firebase deploy 
```

  * Durante o deploy, o Firebase CLI pode perguntar se você deseja deletar funções antigas que não estão mais no seu código local (ex: `helloWorld`). Responda `y` (yes) para removê-las.

-----

## 🚀 Execução e Teste

### Executar Localmente (Emulação)

Para testar o frontend e emular suas funções sem fazer deploy real (ótimo para desenvolvimento):

```bash
# Na raiz do projeto
firebase serve
```

Acesse a URL fornecida (geralmente `http://localhost:5000`) no seu navegador. O upload irá para o Firebase Storage real, mas a função será emulada localmente.

### Testar a Aplicação Implantada

1.  Após o `firebase deploy`, acesse a **Hosting URL** que o Firebase CLI fornece (ex: `https://round-center-461313-g8.web.app`). Faça um **"hard refresh"** (`Ctrl+F5` ou `Cmd+Shift+R`) no navegador.
2.  **Faça o upload** de uma imagem usando a interface e escolha uma opção de processamento.
3.  **Verifique o Firebase Storage:** No [Console do Firebase](https://console.firebase.google.com/), em `Build > Storage > Files`, confirme que o arquivo original está em `uploads/` e o arquivo processado está em `processed/`.
4.  **Verifique o Cloud Firestore:** Em `Build > Firestore Database > Data`, você deve encontrar um novo documento na coleção `processedFiles` com os metadados do arquivo processado e a `processedUrl` real.
5.  **Verifique os Logs das Funções:** No [Google Cloud Console](https://console.cloud.google.com/), vá em `Operations > Logging > Logs Explorer`. Filtre por `Cloud Function` e `processImage` para ver os logs detalhados da execução da sua função e confirmar o processamento.
6.  **Confira o Frontend:** A interface deverá exibir a mensagem de sucesso e um link para o download/visualização do arquivo processado.

-----

## 👨‍💻 Desenvolvedor

[Lucas Ferreira](https://github.com/LucasCleiton)

```
```
