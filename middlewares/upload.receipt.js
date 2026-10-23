import multer from 'multer';

const storage = multer.memoryStorage();

// Comprovante de pagamento (opcional): imagem ou PDF, até 5 MB.
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('O comprovante deve ser uma imagem (JPEG, PNG, WebP) ou um PDF.'), false);
  }
};

export const uploadReceipt = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// Envolve o multer para devolver erros de upload como JSON 400 (sem isso o
// Express responderia com a página de erro padrão em HTML).
export const receiptUploadMiddleware = (req, res, next) => {
  uploadReceipt.single('receipt')(req, res, (error) => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Comprovante muito grande. Máximo 5 MB.' });
    }
    return res.status(400).json({ error: error.message || 'Não foi possível ler o comprovante.' });
  });
};
