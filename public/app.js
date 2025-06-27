// Importe as funções e serviços que você precisa
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";

// Cole a configuração do seu projeto Firebase aqui
const firebaseConfig = {
    apiKey: "AIzaSyCttOvNGNasHYXMEX9LhuWahkhXqvQ3RQ4",
    authDomain: "round-center-461313-g8.firebaseapp.com",
    projectId: "round-center-461313-g8",
    storageBucket: "round-center-461313-g8.firebasestorage.app",
    messagingSenderId: "330602311128",
    appId: "1:330602311128:web:c52f0e733130208c1e56ad",
    measurementId: "G-PCBYL754VE" // Opcional, se não for usar Analytics pode remover
};

// Inicialize o Firebase App
const app = initializeApp(firebaseConfig);

// Obtenha referências para os serviços do Firebase
const storage = getStorage(app);
const db = getFirestore(app);

// Obtenha referências para os elementos do DOM
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileName'); // Para mostrar o nome do arquivo
const actionButtons = document.querySelectorAll('.action-button'); // Seleciona todos os botões de ação
const loader = document.getElementById('loader');
const statusMessage = document.getElementById('statusMessage');
const resultContainer = document.getElementById('resultContainer');
const resultLink = document.getElementById('resultLink');
const extractedTextDisplay = document.getElementById('extractedTextDisplay'); // Referência ao elemento de exibição de texto

let selectedFile = null; // Variável para armazenar o arquivo selecionado

// Função para exibir mensagens
function displayMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
}

// Event listener para quando um arquivo é selecionado
fileInput.addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        fileNameDisplay.textContent = `Arquivo selecionado: ${selectedFile.name}`;
        actionButtons.forEach(button => button.disabled = false); // Habilita os botões de ação
        displayMessage('', ''); // Limpa mensagens anteriores
        resultContainer.style.display = 'none'; // Esconde resultado anterior
        extractedTextDisplay.style.display = 'none'; // Esconde a área de texto extraído
        extractedTextDisplay.textContent = ''; // Limpa o conteúdo da área de texto extraído
    } else {
        fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
        actionButtons.forEach(button => button.disabled = true); // Desabilita os botões de ação
    }
});

// Desabilitar botões de ação inicialmente
actionButtons.forEach(button => button.disabled = true);

// Adicionar event listener para cada botão de ação
actionButtons.forEach(button => {
    button.addEventListener('click', async () => {
        if (!selectedFile) {
            displayMessage('Por favor, selecione um arquivo primeiro.', 'error');
            return;
        }

        const processingType = button.dataset.processingType; // Pega o tipo do atributo data-processing-type
        
        // Resetar interface
        displayMessage('', '');
        resultContainer.style.display = 'none';
        resultLink.href = '#';
        resultLink.textContent = '';
        extractedTextDisplay.style.display = 'none'; // Esconde a área de texto extraído
        extractedTextDisplay.textContent = ''; // Limpa o conteúdo da área de texto extraído
        loader.style.display = 'block'; // Mostra o loader
        actionButtons.forEach(btn => btn.disabled = true); // Desabilita todos os botões durante o processamento

        // Cria uma referência para o arquivo no Storage (pasta 'uploads')
        const uniqueFileName = `${Date.now()}-${selectedFile.name}`;
        const storageRef = ref(storage, `uploads/${uniqueFileName}`);

        // Define metadados personalizados
        const metadata = {
            customMetadata: {
                processingType: processingType,
                originalFileName: selectedFile.name
            }
        };

        try {
            // Faz o upload do arquivo
            await uploadBytes(storageRef, selectedFile, metadata);
            console.log('Upload de arquivo bem-sucedido!', uniqueFileName);
            displayMessage('Arquivo enviado! Aguardando processamento...', 'success');

            // Escuta o Firestore pelo resultado do processamento
            const docRef = doc(db, 'processedFiles', uniqueFileName);

            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                console.log('[FRONTEND] Snapshot Firestore recebido. docSnap.exists():', docSnap.exists());
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.status === 'processed_successfully') {
                        console.log('[FRONTEND] Arquivo processado disponível:', data.processedUrl);
                        loader.style.display = 'none';
                        displayMessage('Processamento concluído!', 'success');
                        
                        // Exibir link
                        resultLink.href = data.processedUrl;
                        resultLink.textContent = `Download: ${data.processedPath.split('/').pop()}`;
                        resultContainer.style.display = 'block';

                        extractedTextDisplay.style.display = 'none'; // Garante que esteja escondido
                        extractedTextDisplay.textContent = ''; // Garante que esteja vazio
                        
                        actionButtons.forEach(btn => btn.disabled = false); // Reabilita botões
                        unsubscribe(); 
                    } else if (data.status === 'processing_failed') {
                        loader.style.display = 'none';
                        displayMessage(`Processamento falhou: ${data.errorMessage || 'Erro desconhecido.'}`, 'error');
                        actionButtons.forEach(btn => btn.disabled = false); // Reabilita botões
                        unsubscribe();
                    } else {
                        // Documento existe mas ainda está em processamento ou não tem processedUrl
                        console.log('[FRONTEND] Processando...');
                    }
                } else {
                    console.log('[FRONTEND] Documento ainda não existe no Firestore.');
                }
            }, (error) => {
                console.error('[FRONTEND] Erro ao escutar Firestore:', error);
                loader.style.display = 'none';
                displayMessage('Erro ao obter resultado do processamento. Verifique o console para detalhes.', 'error');
                actionButtons.forEach(btn => btn.disabled = false); // Reabilita botões
                unsubscribe();
            });

        } catch (error) {
            console.error('Erro ao fazer upload:', error);
            loader.style.display = 'none';
            displayMessage(`Erro ao enviar arquivo: ${error.message}`, 'error');
            actionButtons.forEach(btn => btn.disabled = false); // Reabilita botões
        }
    });
});