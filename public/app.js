// Importe as funções e serviços que você precisa
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js";
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

// ... (Restante do seu código app.js, que continua o mesmo) ...

// Obtenha referências para os elementos do DOM
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const statusMessage = document.getElementById('statusMessage');
const resultContainer = document.getElementById('resultContainer');
const resultLink = document.getElementById('resultLink');
const processingTypeSelect = document.getElementById('processingType');
const loader = document.getElementById('loader');

// Função para exibir mensagens
function displayMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
}

// Event listener para o botão de upload
uploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0]; // Pega o arquivo selecionado
    const processingType = processingTypeSelect.value; // Pega o tipo de processamento selecionado

    if (!file) {
        displayMessage('Por favor, selecione um arquivo.', 'error');
        return;
    }

    // Resetar interface
    displayMessage('', '');
    resultContainer.style.display = 'none';
    resultLink.href = '#';
    resultLink.textContent = '';
    loader.style.display = 'block'; // Mostra o loader

    // Cria uma referência para o arquivo no Storage (pasta 'uploads')
    // Usamos um timestamp para garantir nomes de arquivos únicos e evitar colisões
    const uniqueFileName = `${Date.now()}-${file.name}`; // Corrigido a string template aqui
    const storageRef = ref(storage, `uploads/${uniqueFileName}`); // Usando ref do new SDK

    // Define metadados personalizados para a função saber o tipo de processamento
    const metadata = {
        customMetadata: {
            processingType: processingType,
            originalFileName: file.name // Nome original para referência no Firestore
        }
    };

    try {
        // Faz o upload do arquivo
        const snapshot = await uploadBytes(storageRef, file, metadata); // Usando uploadBytes do new SDK
        console.log('Upload de arquivo bem-sucedido!', snapshot);
        displayMessage('Arquivo enviado! Aguardando processamento...', 'success');

        // Agora, vamos escutar o Firestore pelo resultado do processamento
        // Usamos o nome do arquivo único como ID do documento no Firestore
        const docRef = doc(db, 'processedFiles', uniqueFileName); // Usando doc do new SDK

        // Escuta por mudanças no documento do Firestore
        const unsubscribe = onSnapshot(docRef, (docSnap) => { // Usando onSnapshot do new SDK
            if (docSnap.exists() && docSnap.data().processedUrl) {
                const data = docSnap.data();
                console.log('Arquivo processado disponível:', data.processedUrl);
                loader.style.display = 'none'; // Esconde o loader
                displayMessage('Processamento concluído!', 'success');
                resultLink.href = data.processedUrl;
                resultLink.textContent = `Download: ${data.processedPath.split('/').pop()}`;
                resultContainer.style.display = 'block';
                unsubscribe(); // Para de escutar uma vez que o resultado é obtido
            }
        }, (error) => {
            console.error('Erro ao escutar Firestore:', error);
            loader.style.display = 'none'; // Esconde o loader
            displayMessage('Erro ao obter resultado do processamento.', 'error');
            unsubscribe();
        });

    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        loader.style.display = 'none'; // Esconde o loader
        displayMessage(`Erro ao enviar arquivo: ${error.message}`, 'error');
    }
});