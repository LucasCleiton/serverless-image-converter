const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(); // Inicializa o SDK Admin para acessar outros serviços Firebase

const path = require('path');
const os = require('os');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
// const { createWorker } = require('tesseract.js'); // <<<< LINHA COMENTADA/REMOVIDA

exports.processImage = functions
  // Configurações de runtime para Geração 1 (memória e tempo limite)
  .runWith({ memory: '1GB', timeoutSeconds: 300 })
  .storage
  .object()
  .onFinalize(async (object) => {
    const fileBucket = object.bucket; // O bucket onde o arquivo foi enviado.
    const filePath = object.name; // Caminho completo do arquivo dentro do bucket.
    const contentType = object.contentType; // Tipo de conteúdo (mime-type) do arquivo.
    const metageneration = object.metageneration; // Para garantir que é um novo arquivo.

    console.log(`[REAL] Iniciando processamento para o arquivo: ${filePath}`);

    // 1. Condições de Saída Antecipada:
    // Permite agora processar PDFs também para OCR
    if (!contentType || (!contentType.startsWith('image/') && contentType !== 'application/pdf')) {
      console.log('[REAL] Não é imagem ou PDF suportado. Ignorando.');
      return null;
    }
    // Evita loops infinitos: Se o arquivo já estiver na pasta 'processed/', ignora.
    if (filePath.startsWith('processed/')) {
        console.log('[REAL] Arquivo já processado (na pasta "processed/"). Ignorando.');
        return null;
    }
    // Garante que é um novo arquivo (não uma atualização de metadados, por exemplo).
    if (metageneration !== '1') {
      console.log('[REAL] Não é a primeira versão. Ignorando.');
      return null;
    }

    const bucket = admin.storage().bucket(fileBucket);
    const fileName = path.basename(filePath); // Apenas o nome do arquivo (ex: '1718223456789-minha_foto.jpg')
    const fileExtension = path.extname(fileName).toLowerCase(); // Extensão (ex: '.jpg')
    const baseName = path.basename(fileName, fileExtension); // Nome sem extensão (ex: '1718223456789-minha_foto')

    const tempFilePath = path.join(os.tmpdir(), fileName); // Caminho temporário para download

    // ✅ Acessando o `processingType` diretamente dos metadados.
    const processingType = object.metadata?.processingType || 'resize'; 
    console.log(`[REAL] Tipo de processamento detectado: ${processingType}`); // Log para depuração

    let processedFileName; 
    let processedFilePath; 
    let newContentType; 
    // let extractedText = null; // <<<< REMOVIDO/COMENTADO

    // Lógica para definir o nome do arquivo processado e o novo tipo de conteúdo
    switch (processingType) {
        case 'grayscale':
            processedFileName = `${baseName}_grayscale${fileExtension}`;
            newContentType = contentType;
            break;
        case 'convertToPdf':
            processedFileName = `${baseName}.pdf`; // Garante a extensão .pdf
            newContentType = 'application/pdf';
            break;
        // case 'extractText': // <<<< REMOVIDO/COMENTADO
        //     processedFileName = `${baseName}_extracted_text.txt`; 
        //     newContentType = 'text/plain';
        //     break;
        case 'resize':
        default: // 'resize' ou qualquer outro valor padrão
            processedFileName = `${baseName}_resized${fileExtension}`;
            newContentType = contentType;
            break;
    }

    processedFilePath = `processed/${processedFileName}`; // Caminho final no Storage
    const targetTempFilePath = path.join(os.tmpdir(), processedFileName); // Caminho temporário para o arquivo processado

    let fileBuffer;

    try {
        // Baixa o arquivo original para um buffer
        [fileBuffer] = await bucket.file(filePath).download();
        fs.writeFileSync(tempFilePath, fileBuffer); // Salva o buffer em um arquivo temporário
        console.log('[REAL] Arquivo original baixado para:', tempFilePath);

        if (processingType === 'convertToPdf') {
            console.log('[REAL] Convertendo imagem para PDF...');
            
            const standardizedImageBuffer = await sharp(fileBuffer)
                .jpeg({ quality: 90 }) 
                .toBuffer();

            const pdfDoc = await PDFDocument.create(); 
            let embeddedImage;

            try { 
                embeddedImage = await pdfDoc.embedJpg(standardizedImageBuffer);
            } catch (jpgError) { 
                console.warn('[REAL] Falha ao embedar como JPG, tentando PNG:', jpgError.message);
                embeddedImage = await pdfDoc.embedPng(standardizedImageBuffer);
            }
            
            const page = pdfDoc.addPage();
            
            console.log(`[REAL] Dimensões da imagem embutida: ${embeddedImage.width}x${embeddedImage.height}`);
            console.log(`[REAL] Dimensões da página PDF: ${page.getWidth()}x${page.getHeight()}`);

            const pageWidth = page.getWidth();
            const pageHeight = page.getHeight();
            const imgWidth = embeddedImage.width;
            const imgHeight = embeddedImage.height;

            const scaleFactorWidth = pageWidth / imgWidth;
            const scaleFactorHeight = pageHeight / imgHeight;
            const scaleFactor = Math.min(scaleFactorWidth, scaleFactorHeight);

            const scaledWidth = imgWidth * scaleFactor;
            const scaledHeight = imgHeight * scaleFactor;

            console.log(`[REAL] Dimensões da imagem escalada (CORRIGIDO): ${scaledWidth}x${scaledHeight}`);

            page.drawImage(embeddedImage, {
                x: (pageWidth - scaledWidth) / 2,
                y: (pageHeight - scaledHeight) / 2, 
                width: scaledWidth,
                height: scaledHeight,
            });

            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(targetTempFilePath, pdfBytes);
            console.log('[REAL] Imagem convertida para PDF e salva temporariamente em:', targetTempFilePath);

        } else { // Lógica existente para redimensionar ou preto e branco
            let imageProcessor = sharp(tempFilePath);

            if (processingType === 'grayscale') {
                imageProcessor = imageProcessor.grayscale();
                console.log('[REAL] Aplicando filtro preto e branco...');
            } else { 
                imageProcessor = imageProcessor.resize({ width: 800 }); 
                console.log('[REAL] Redimensionando imagem para 800px de largura...');
            }

            await imageProcessor.toFile(targetTempFilePath);
            console.log('[REAL] Imagem processada salva temporariamente em:', targetTempFilePath);
        }

        await bucket.upload(targetTempFilePath, {
            destination: processedFilePath,
            metadata: {
                contentType: newContentType, 
                // extractedText: extractedText ? encodeURIComponent(extractedText) : undefined // <<<< REMOVIDO/COMENTADO
            }
        });
        console.log('[REAL] Arquivo processado enviado para o Storage em:', processedFilePath);

        const [url] = await bucket.file(processedFilePath).getSignedUrl({
            action: 'read',
            expires: '03-09-2491',
        });
        console.log('[REAL] URL do arquivo processado gerada:', url);

        const db = admin.firestore();
        const docId = fileName; 
        
        await db.collection('processedFiles').doc(docId).set({
            originalPath: filePath,
            processedPath: processedFilePath,
            processedUrl: url,
            status: 'processed_successfully',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            processingType: processingType,
            // extractedText: extractedText // <<<< REMOVIDO/COMENTADO
        });
        console.log('[REAL] Dados do arquivo processado (reais) salvos no Firestore.');

    } catch (error) {
        console.error('[REAL] Erro no processamento do arquivo:', error);
        const db = admin.firestore();
        await db.collection('processedFiles').doc(fileName).set({
            originalPath: filePath,
            status: 'processing_failed',
            errorMessage: error.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } finally {
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