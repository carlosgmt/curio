"use client";

import React, { Suspense } from "react";
import { X } from "lucide-react";
import { AuthForm } from "./AuthForm";

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, token: string, isRegister: boolean) => void;
  defaultTab?: "login" | "register";
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  defaultTab = "login",
}: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 p-2 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          title="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-400 font-mono">Loading authentication...</div>}>
          <AuthForm
            initialMode={defaultTab}
            isModal={true}
            onClose={onClose}
            onSuccess={(user, token, isRegister) => {
              onSuccess(user, token, isRegister);
              onClose();
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
