export interface DocumentPreviewProps {
  document: { url: string; title: string; expiresAt: string };
  onClose: () => void;
  onDownload: () => Promise<void>;
  onNativeOpen?: () => Promise<void>;
}

export default function DocumentPreview(_props: DocumentPreviewProps) {
  return null;
}
