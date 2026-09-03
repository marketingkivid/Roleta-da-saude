import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Loader2 } from 'lucide-react';

interface PrizeImageUploadProps {
  imageUrl: string;
  onImageChange: (url: string) => void;
}

const PrizeImageUpload = ({ imageUrl, onImageChange }: PrizeImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);

    try {
      if (imageUrl) {
        const oldPath = imageUrl.split('/prize-images/')[1];
        if (oldPath) {
          await supabase.storage.from('prize-images').remove([oldPath]);
        }
      }

      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage.from('prize-images').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) throw error;

      const { data } = supabase.storage.from('prize-images').getPublicUrl(path);
      onImageChange(data.publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [imageUrl, onImageChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleRemove = useCallback(async () => {
    if (imageUrl) {
      const oldPath = imageUrl.split('/prize-images/')[1];
      if (oldPath) {
        await supabase.storage.from('prize-images').remove([oldPath]);
      }
    }
    onImageChange('');
  }, [imageUrl, onImageChange]);

  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 400, color: '#9B8FAE', marginBottom: 6, fontFamily: 'Nunito, sans-serif' }}>
        Imagem do prêmio
      </label>

      {imageUrl ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={imageUrl}
            alt="Preview do prêmio"
            style={{
              width: 160,
              height: 160,
              objectFit: 'cover',
              borderRadius: 20,
              border: '1.5px solid #E8E0EE',
            }}
          />
          <button
            type="button"
            onClick={handleRemove}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#EF4444',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? '#E8357A' : '#E8E0EE'}`,
            borderRadius: 20,
            padding: '24px 16px',
            textAlign: 'center',
            cursor: uploading ? 'default' : 'pointer',
            background: dragOver ? '#FDF0F5' : '#FFFFFF',
            transition: 'all 0.2s',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          {uploading ? (
            <Loader2 size={28} style={{ color: '#9B8FAE', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <Upload size={28} style={{ color: '#9B8FAE', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 16, color: '#5A5A7A', margin: 0 }}>
                Clique ou arraste uma imagem
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};

export default PrizeImageUpload;
