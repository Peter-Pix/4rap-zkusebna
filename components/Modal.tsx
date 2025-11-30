import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'info' | 'confirm';
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  message,
  type = 'info',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Zrušit'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border-4 border-black shadow-hard w-full max-w-md relative animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-brand-cyan border-b-4 border-black p-4 flex justify-between items-center">
          <h3 className="font-black uppercase text-xl">{title}</h3>
          <button onClick={onCancel} className="hover:bg-black hover:text-white transition-colors p-1 border-2 border-transparent hover:border-black">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-lg font-bold mb-8">{message}</p>

          <div className="flex gap-4 justify-end">
            {type === 'confirm' && (
              <Button onClick={onCancel} variant="secondary">
                {cancelText}
              </Button>
            )}
            <Button onClick={onConfirm} variant="black">
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};