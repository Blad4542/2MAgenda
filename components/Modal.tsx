"use client";
import { Dialog } from "@headlessui/react";
import { X } from "lucide-react";
import { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
            {title && (
              <Dialog.Title className="text-base font-semibold text-gray-900">
                {title}
              </Dialog.Title>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="ml-auto text-gray-400 hover:text-gray-700 hover:bg-gray-200 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
