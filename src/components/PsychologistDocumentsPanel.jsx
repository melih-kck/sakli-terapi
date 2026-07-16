import { useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import {
  createVerificationDocumentUrl,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  fetchMyVerificationDocuments,
  removeVerificationDocument,
  uploadVerificationDocument,
  validateVerificationFile,
} from '../lib/verification-documents';

const formatDate = (value) => new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
}).format(new Date(value));

const formatFileSize = (size) => `${(size / 1024 / 1024).toFixed(2)} MB`;

export default function PsychologistDocumentsPanel({ user }) {
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [documentType, setDocumentType] = useState('diploma');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const userId = user?.id;

  useEffect(() => {
    let isMounted = true;

    const loadDocuments = async () => {
      if (!userId || userId.startsWith('mock-')) {
        if (isMounted) {
          setDocuments([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        const loadedDocuments = await fetchMyVerificationDocuments(userId);
        if (isMounted) setDocuments(loadedDocuments);
      } catch (error) {
        console.error('Mesleki belgeler yüklenemedi:', error);
        if (isMounted) showError('Belgeler Yüklenemedi', 'Mesleki belgelerinize şu anda erişilemiyor.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    Promise.resolve().then(loadDocuments);
    return () => { isMounted = false; };
  }, [showError, userId]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    const validationError = validateVerificationFile(file);
    if (validationError) {
      setSelectedFile(null);
      event.target.value = '';
      showError('Dosya Seçilemedi', validationError);
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    const validationError = validateVerificationFile(selectedFile);
    if (validationError) {
      showError('Belge Yüklenemedi', validationError);
      return;
    }

    setProcessingId('upload');
    try {
      const uploaded = await uploadVerificationDocument({
        userId,
        documentType,
        file: selectedFile,
      });
      setDocuments(current => [uploaded, ...current]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      success('Belge Yüklendi', 'Belgeniz güvenli biçimde alındı ve inceleme sırasına eklendi.');
    } catch (error) {
      console.error('Mesleki belge yüklenemedi:', error);
      showError('Belge Yüklenemedi', error.message || 'Dosya yükleme işlemi tamamlanamadı.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleView = async (document) => {
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    setProcessingId(`view-${document.id}`);
    try {
      const signedUrl = await createVerificationDocumentUrl(document.storage_path);
      if (previewWindow) previewWindow.location.href = signedUrl;
      else window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      previewWindow?.close();
      console.error('Belge açılamadı:', error);
      showError('Belge Açılamadı', 'Güvenli belge bağlantısı oluşturulamadı.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (document) => {
    if (!window.confirm(`${document.original_name} adlı belgeyi silmek istediğinize emin misiniz?`)) return;
    setProcessingId(`delete-${document.id}`);
    try {
      await removeVerificationDocument(document);
      setDocuments(current => current.filter(item => item.id !== document.id));
      success('Belge Silindi', 'Belge ve kayıt bilgisi güvenli depodan kaldırıldı.');
    } catch (error) {
      console.error('Mesleki belge silinemedi:', error);
      showError('Belge Silinemedi', error.message || 'Belge silme işlemi tamamlanamadı.');
    } finally {
      setProcessingId(null);
    }
  };

  const approvedCount = documents.filter(document => document.status === 'approved').length;
  const approvalStatus = user?.psychologistProfile?.approvalStatus || 'pending';

  return (
    <section className="verification-panel">
      <div className={`verification-summary ${approvedCount > 0 ? 'is-complete' : ''}`}>
        <strong>{approvedCount > 0 ? 'Belge doğrulaması tamamlandı' : 'Belge doğrulaması bekleniyor'}</strong>
        <p>
          {approvedCount > 0
            ? `${approvedCount} mesleki belgeniz onaylandı.`
            : 'Profilinizin etkinleştirilebilmesi için en az bir mesleki belgenizin onaylanması gerekir.'}
        </p>
        {approvalStatus === 'approved' && <span className="badge badge-success">Profil aktif</span>}
      </div>

      <div className="verification-upload-form">
        <div className="input-group">
          <label htmlFor="verification-document-type">Belge Türü</label>
          <select
            id="verification-document-type"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
          >
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="input-group verification-file-field">
          <label htmlFor="verification-document-file">Dosya</label>
          <input
            ref={fileInputRef}
            id="verification-document-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
          />
          <span className="input-hint">PDF, JPG veya PNG; en fazla 8 MB.</span>
        </div>

        <button
          type="button"
          className="btn btn-primary verification-upload-button"
          disabled={!selectedFile || processingId === 'upload'}
          onClick={handleUpload}
        >
          {processingId === 'upload' ? 'Yükleniyor...' : 'Belgeyi Yükle'}
        </button>
      </div>

      <div className="verification-privacy-note">
        Belgeleriniz herkese açık profilde gösterilmez. Yalnızca siz ve yetkili yöneticiler erişebilir.
      </div>

      <div className="verification-document-list" aria-live="polite">
        <h4>Yüklenen Belgeler</h4>
        {isLoading ? (
          <p className="text-secondary">Belgeler yükleniyor...</p>
        ) : documents.length === 0 ? (
          <p className="verification-empty">Henüz belge yüklenmedi.</p>
        ) : documents.map(document => (
          <div className="verification-document-row" key={document.id}>
            <div className="verification-document-info">
              <strong>{DOCUMENT_TYPE_LABELS[document.document_type] || 'Mesleki belge'}</strong>
              <span>{document.original_name}</span>
              <small>{formatFileSize(document.size_bytes)} · {formatDate(document.created_at)}</small>
              {document.review_reason && (
                <p className="verification-review-reason">Açıklama: {document.review_reason}</p>
              )}
            </div>
            <div className="verification-document-actions">
              <span className={`badge verification-status is-${document.status}`}>
                {DOCUMENT_STATUS_LABELS[document.status] || document.status}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={processingId === `view-${document.id}`}
                onClick={() => handleView(document)}
              >
                Görüntüle
              </button>
              {document.status !== 'approved' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  disabled={processingId === `delete-${document.id}`}
                  onClick={() => handleDelete(document)}
                >
                  Sil
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
