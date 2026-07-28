import { useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import {
  createVerificationDocumentUrl,
  DOCUMENT_TYPE_LABELS,
  fetchMyVerificationDocuments,
  removeVerificationDocument,
  uploadVerificationDocument,
  validateVerificationFile,
} from '../lib/verification-documents';

const formatDate = (value, locale) => new Intl.DateTimeFormat(locale, {
  dateStyle: 'medium',
}).format(new Date(value));

const formatFileSize = (size) => `${(size / 1024 / 1024).toFixed(2)} MB`;

export default function PsychologistDocumentsPanel({ user }) {
  const { success, error: showError } = useToast();
  const { language, t } = useLanguage();
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
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
    setProcessingId(`view-${document.id}`);
    try {
      const signedUrl = await createVerificationDocumentUrl(document.storage_path);
      window.location.assign(signedUrl);
    } catch (error) {
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
        <strong>{approvedCount > 0 ? t('documentsPanel.complete') : t('documentsPanel.pending')}</strong>
        <p>
          {approvedCount > 0
            ? t('documentsPanel.approvedCount', { count: approvedCount })
            : t('documentsPanel.requirement')}
        </p>
        {approvalStatus === 'approved' && <span className="badge badge-success">{t('documentsPanel.profileActive')}</span>}
      </div>

      <div className="verification-upload-form">
        <div className="input-group">
          <label htmlFor="verification-document-type">{t('documentsPanel.type')}</label>
          <select
            id="verification-document-type"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
          >
            {Object.keys(DOCUMENT_TYPE_LABELS).map(value => (
              <option key={value} value={value}>{t(`admin.documentTypes.${value}`)}</option>
            ))}
          </select>
        </div>

        <div className="input-group verification-file-field">
          <label htmlFor="verification-document-file">{t('documentsPanel.file')}</label>
          <input
            ref={fileInputRef}
            id="verification-document-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
          />
          <span className="input-hint">{t('documentsPanel.fileHint')}</span>
        </div>

        <button
          type="button"
          className="btn btn-primary verification-upload-button"
          disabled={!selectedFile || processingId === 'upload'}
          onClick={handleUpload}
        >
          {processingId === 'upload' ? t('documentsPanel.uploading') : t('documentsPanel.upload')}
        </button>
      </div>

      <div className="verification-privacy-note">
        {t('documentsPanel.privacy')}
      </div>

      <div className="verification-document-list" aria-live="polite">
        <h4>{t('documentsPanel.uploaded')}</h4>
        {isLoading ? (
          <p className="text-secondary">{t('documentsPanel.loading')}</p>
        ) : documents.length === 0 ? (
          <p className="verification-empty">{t('documentsPanel.empty')}</p>
        ) : documents.map(document => (
          <div className="verification-document-row" key={document.id}>
            <div className="verification-document-info">
              <strong>{t(`admin.documentTypes.${document.document_type}`)}</strong>
              <span>{document.original_name}</span>
              <small>{formatFileSize(document.size_bytes)} · {formatDate(document.created_at, locale)}</small>
              {document.review_reason && (
                <p className="verification-review-reason">{t('documentsPanel.explanation', { reason: document.review_reason })}</p>
              )}
            </div>
            <div className="verification-document-actions">
              <span className={`badge verification-status is-${document.status}`}>
                {t(`admin.documentStatuses.${document.status}`)}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={processingId === `view-${document.id}`}
                onClick={() => handleView(document)}
              >
                {t('documentsPanel.view')}
              </button>
              {document.status !== 'approved' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  disabled={processingId === `delete-${document.id}`}
                  onClick={() => handleDelete(document)}
                >
                  {t('documentsPanel.delete')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
