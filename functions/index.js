const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const path = require('path');
const os = require('os');
const fs = require('fs');
const sharp = require('sharp'); 

exports.processImage = functions
  .runWith({ memory: '1GB', timeoutSeconds: 300 }) // Mantendo as configurações de runtime
  .storage
  .object()
  .onFinalize(async (object) => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;
    const metageneration = object.metageneration;

    console.log(`[REAL] Iniciando processamento para o arquivo: ${filePath}`);

    // Condições de Saída Antecipada
    if (!contentType || !contentType.startsWith('image/')) {
      console.log('[REAL] Não é imagem ou contentType ausente. Ignorando.');
      return null;
    }
    // IMPORTANTE: Adicione esta verificação para evitar loop se a função salvar na mesma pasta.
    // Garante que não processamos arquivos que já estão na pasta 'processed/'.
    if (filePath.startsWith('processed/')) {
        console.log('[REAL] Imagem já processada (na pasta "processed/"). Ignorando.');
        return null;
    }
    if (metageneration !== '1') {
      console.log('[REAL] Não é a primeira versão. Ignorando.');
      return null;
    }

    const bucket = admin.storage().bucket(fileBucket);
    const fileName = path.basename(filePath); // Ex: "1718223456789-minha_foto.jpg"
    const fileExtension = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, fileExtension);

    const tempFilePath = path.join(os.tmpdir(), fileName);
    const processingType = object.metadata?.customMetadata?.processingType || 'resize';

    let processedFileName; // Usar 'let' para que possa ser reatribuído
    let processedFilePath; // Usar 'let' para que possa ser reatribuído

    switch (processingType) {
        case 'grayscale':
            processedFileName = `${baseName}_grayscale${fileExtension}`;
            break;
        case 'resize':
        default:
            processedFileName = `${baseName}_resized${fileExtension}`;
            break;
    }
    processedFilePath = `processed/${processedFileName}`; // Caminho onde o arquivo processado será salvo
    const targetTempFilePath = path.join(os.tmpdir(), processedFileName); // Caminho temporário para o arquivo processado

    try {
        // 1. Baixar o arquivo original
        await bucket.file(filePath).download({ destination: tempFilePath });
        console.log('[REAL] Imagem original baixada para:', tempFilePath);

        // 2. Processar a imagem com Sharp
        let imageProcessor = sharp(tempFilePath); // Usar 'let' para reatribuição

        if (processingType === 'grayscale') {
            imageProcessor = imageProcessor.grayscale();
            console.log('[REAL] Aplicando filtro preto e branco...');
        } else { // Padrão é redimensionar
            imageProcessor = imageProcessor.resize(800); // Reduz para largura de 800px, altura automática
            console.log('[REAL] Redimensionando imagem para 800px de largura...');
        }

        await imageProcessor.toFile(targetTempFilePath);
        console.log('[REAL] Imagem processada salva temporariamente em:', targetTempFilePath);

        // 3. Fazer upload da imagem processada
        await bucket.upload(targetTempFilePath, {
            destination: processedFilePath, // Salva na pasta 'processed/'
            metadata: { contentType: contentType } // Mantém o tipo de conteúdo original
        });
        console.log('[REAL] Imagem processada enviada para o Storage em:', processedFilePath);

        // 4. Gerar a URL pública do arquivo processado
        const [url] = await bucket.file(processedFilePath).getSignedUrl({
            action: 'read',
            expires: '03-09-2491', // URL de expiração bem longa (ajuste para segurança real)
        });
        console.log('[REAL] URL da imagem processada gerada:', url);

        // 5. Salvar os detalhes do arquivo processado no Cloud Firestore
        const db = admin.firestore();
        const docId = fileName; // O mesmo ID que o frontend usou para o upload original
        
        await db.collection('processedFiles').doc(docId).set({
            originalPath: filePath,
            processedPath: processedFilePath,
            processedUrl: url, // <<<<<<< AGORA COM A URL REAL!
            status: 'processed_successfully', // Novo status para indicar sucesso real
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            processingType: processingType
        });
        console.log('[REAL] Dados do arquivo processado (reais) salvos no Firestore.');

    } catch (error) {
        console.error('[REAL] Erro no processamento da imagem:', error);
        // Opcional: Salvar status de erro no Firestore para o frontend lidar
        const db = admin.firestore();
        await db.collection('processedFiles').doc(fileName).set({
            originalPath: filePath,
            status: 'processing_failed',
            errorMessage: error.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true }); // Use merge para atualizar sem sobrescrever se já existir
    } finally {
        // 6. Limpar arquivos temporários (muito importante!)
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log('[REAL] Arquivo original temporário removido.');
        }
        if (fs.existsSync(targetTempFilePath)) {
            fs.unlinkSync(targetTempFilePath);
            console.log('[REAL] Arquivo processado temporário removido.');
        }
    }
    return null;
});