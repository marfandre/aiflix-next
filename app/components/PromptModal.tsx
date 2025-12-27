"use client";

import { useState } from "react";

type Props = {
    prompt: string | null | undefined;
    description?: string | null;
    isOpen: boolean;
    onClose: () => void;
};

/**
 * Универсальное модальное окно для отображения промта.
 * Закрывается по клику вне окна.
 */
export default function PromptModal({ prompt, description, isOpen, onClose }: Props) {
    const [copied, setCopied] = useState(false);

    const text = prompt || description || "";

    const handleCopy = async () => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error("copy prompt error", e);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-[85%] mx-6 max-h-[80%] overflow-auto rounded-xl bg-white/15 backdrop-blur-md p-6 border border-white/30"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 mb-4">
                    <h3 className="text-white font-medium">Промт</h3>
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!text}
                        className="rounded-full bg-white/20 p-2 hover:bg-white/30 disabled:opacity-40 text-white transition-colors"
                        title="Скопировать промт"
                    >
                        {copied ? (
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : (
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <rect x="9" y="9" width="11" height="11" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                        )}
                    </button>
                </div>
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                    {text || "Промт не указан"}
                </p>
            </div>
        </div>
    );
}
