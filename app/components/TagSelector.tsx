"use client";

import { useState, useEffect, useRef, useMemo } from "react";

type Tag = {
    id: string;
    name_ru: string;
    name_en: string;
    category: string;
};

type TagsData = {
    genre: Tag[];
    mood: Tag[];
    scene: Tag[];
    all: Tag[];
};

interface TagSelectorProps {
    selectedTags: string[];
    onTagsChange: (tags: string[]) => void;
    maxTags?: number;
    placeholder?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    genre: "жанр",
    mood: "атмосфера",
    scene: "сцена",
};

const CATEGORY_LABELS_FULL: Record<string, string> = {
    genre: "Жанры",
    mood: "Атмосфера",
    scene: "Сцена",
};

export default function TagSelector({
    selectedTags,
    onTagsChange,
    maxTags = 10,
    placeholder = "Введите тег...",
}: TagSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [tagsData, setTagsData] = useState<TagsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);
    const [preferEnglish, setPreferEnglish] = useState(false); // запоминаем язык при вводе
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(["genre", "mood", "scene"])
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Загрузка тегов
    useEffect(() => {
        async function loadTags() {
            setLoading(true);
            try {
                const res = await fetch("/api/tags");
                if (res.ok) {
                    const data = await res.json();
                    setTagsData(data);
                }
            } catch (err) {
                console.error("Failed to load tags:", err);
            } finally {
                setLoading(false);
            }
        }
        loadTags();
    }, []);

    // Закрытие при клике вне
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowAll(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Фильтрация по поиску - возвращает плоский список с приоритетом "начинается с"
    const filteredTags = useMemo(() => {
        if (!tagsData) return [];

        const searchLower = search.toLowerCase().trim();
        if (!searchLower) return tagsData.all;

        // Разделяем на: начинаются с поисковой строки vs содержат её
        const startsWithSearch: Tag[] = [];
        const containsSearch: Tag[] = [];

        for (const t of tagsData.all) {
            const nameRu = t.name_ru.toLowerCase();
            const nameEn = t.name_en.toLowerCase();
            const id = t.id.toLowerCase();

            if (nameRu.startsWith(searchLower) || nameEn.startsWith(searchLower) || id.startsWith(searchLower)) {
                startsWithSearch.push(t);
            } else if (nameRu.includes(searchLower) || nameEn.includes(searchLower) || id.includes(searchLower)) {
                containsSearch.push(t);
            }
        }

        // Сначала теги, начинающиеся с поиска, потом остальные
        return [...startsWithSearch, ...containsSearch];
    }, [tagsData, search]);

    // Для режима "Все теги" - по категориям
    const allByCategory = useMemo(() => {
        if (!tagsData) return { genre: [], mood: [], scene: [] };
        return {
            genre: tagsData.genre,
            mood: tagsData.mood,
            scene: tagsData.scene,
        };
    }, [tagsData]);

    const toggleTag = (tagId: string) => {
        // Ищем тег с любым языковым суффиксом
        const existingTag = selectedTags.find((t) => t === tagId || t.startsWith(tagId + ':'));

        if (existingTag) {
            // Удаляем тег (с любым суффиксом)
            onTagsChange(selectedTags.filter((t) => t !== existingTag));
        } else if (selectedTags.length < maxTags) {
            // Добавляем тег с суффиксом языка
            const langSuffix = preferEnglish ? ':en' : ':ru';
            onTagsChange([...selectedTags, tagId + langSuffix]);
        }
        setSearch("");
    };

    const removeTag = (tagId: string) => {
        onTagsChange(selectedTags.filter((t) => t !== tagId));
    };

    const toggleCategory = (category: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    // Парсит tagId в формате "tag_id:lang" или просто "tag_id"
    const parseTagWithLang = (tagWithLang: string): { tagId: string; lang: 'en' | 'ru' } => {
        if (tagWithLang.endsWith(':en')) {
            return { tagId: tagWithLang.slice(0, -3), lang: 'en' };
        }
        if (tagWithLang.endsWith(':ru')) {
            return { tagId: tagWithLang.slice(0, -3), lang: 'ru' };
        }
        return { tagId: tagWithLang, lang: 'ru' }; // по умолчанию русский
    };

    const getTagById = (id: string): Tag | undefined => {
        const { tagId } = parseTagWithLang(id);
        return tagsData?.all.find((t) => t.id === tagId);
    };

    const getTagDisplayName = (tagWithLang: string): string => {
        const { tagId, lang } = parseTagWithLang(tagWithLang);
        const tag = tagsData?.all.find((t) => t.id === tagId);
        if (!tag) return tagId;
        return lang === 'en' ? tag.name_en : tag.name_ru;
    };

    // Подсветка совпадений в тексте
    const highlightMatch = (text: string, query: string) => {
        if (!query.trim()) return text;

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase().trim();
        const index = lowerText.indexOf(lowerQuery);

        if (index === -1) return text;

        const before = text.slice(0, index);
        const match = text.slice(index, index + lowerQuery.length);
        const after = text.slice(index + lowerQuery.length);

        return (
            <>
                {before}
                <span className="font-semibold text-gray-900">{match}</span>
                {after}
            </>
        );
    };

    const isSearching = search.trim().length >= 1;

    // Определяем язык ввода и запоминаем его
    const hasLatin = /[a-zA-Z]/.test(search);
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(search);

    // Обновляем preferEnglish при вводе
    if (search.length > 0) {
        const currentlyEnglish = hasLatin && !hasCyrillic;
        if (currentlyEnglish !== preferEnglish) {
            setPreferEnglish(currentlyEnglish);
        }
    }

    const getDisplayName = (tag: Tag) => preferEnglish ? tag.name_en : tag.name_ru;

    // Первые 7 результатов для режима поиска
    const searchResults = filteredTags.slice(0, 7);

    return (
        <div ref={containerRef} className="relative">
            {/* Выбранные теги + input */}
            <div
                className="flex flex-wrap items-center gap-1.5 min-h-[40px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 cursor-text"
                onClick={() => {
                    setIsOpen(true);
                    inputRef.current?.focus();
                }}
            >
                {selectedTags.map((tagId) => {
                    return (
                        <span
                            key={tagId}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                        >
                            <span>{getTagDisplayName(tagId)}</span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeTag(tagId);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ×
                            </button>
                        </span>
                    );
                })}
                <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setShowAll(false);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={selectedTags.length === 0 ? placeholder : ""}
                    className="flex-1 min-w-[100px] border-none outline-none bg-transparent text-sm placeholder:text-gray-400"
                />
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-[320px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {loading ? (
                        <div className="px-3 py-4 text-center text-sm text-gray-400">
                            Загрузка тегов...
                        </div>
                    ) : !isSearching && !showAll ? (
                        // Начальное состояние
                        <div className="px-3 py-4 text-center text-sm text-gray-400">
                            Введите название тега для поиска
                        </div>
                    ) : isSearching && !showAll ? (
                        // Режим поиска: простой список из 7 элементов
                        <>
                            {searchResults.length === 0 ? (
                                <div className="px-3 py-4 text-center">
                                    <p className="text-sm text-gray-400 mb-2">Теги не найдены</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch("");
                                            setShowAll(true);
                                        }}
                                        className="text-xs text-gray-600 hover:text-gray-900"
                                    >
                                        Все теги →
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    {searchResults.map((tag) => {
                                        const isSelected = selectedTags.includes(tag.id);
                                        const isDisabled = !isSelected && selectedTags.length >= maxTags;
                                        const isHovered = hoveredTagId === tag.id;

                                        return (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => !isDisabled && toggleTag(tag.id)}
                                                onMouseEnter={() => setHoveredTagId(tag.id)}
                                                onMouseLeave={() => setHoveredTagId(null)}
                                                disabled={isDisabled}
                                                className={`flex w-full items-center justify-between px-3 py-2 text-sm transition ${isSelected
                                                    ? "bg-gray-100 text-gray-900 font-medium"
                                                    : isDisabled
                                                        ? "text-gray-300 cursor-not-allowed"
                                                        : "text-gray-700 hover:bg-gray-50"
                                                    }`}
                                            >
                                                <span>{highlightMatch(getDisplayName(tag), search)}</span>
                                                {isHovered && !isDisabled && !isSelected && (
                                                    <span className="text-xs text-gray-400">
                                                        {CATEGORY_LABELS[tag.category]}
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <span className="text-xs text-gray-500">✓</span>
                                                )}
                                            </button>
                                        );
                                    })}

                                    {/* Кнопка "Все теги" внизу */}
                                    <div className="border-t border-gray-100 px-3 py-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearch("");
                                                setShowAll(true);
                                            }}
                                            className="text-xs text-gray-500 hover:text-gray-700"
                                        >
                                            Все теги →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : showAll ? (
                        // Режим "Все теги" - по категориям
                        <>
                            <div className="px-3 py-2 border-b border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowAll(false)}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                    ← Назад
                                </button>
                            </div>

                            {(["genre", "mood", "scene"] as const).map((category) => {
                                const tags = allByCategory[category];
                                if (tags.length === 0) return null;

                                const isExpanded = expandedCategories.has(category);

                                return (
                                    <div key={category} className="border-b border-gray-100 last:border-b-0">
                                        <button
                                            type="button"
                                            onClick={() => toggleCategory(category)}
                                            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                                        >
                                            <span>
                                                {CATEGORY_LABELS_FULL[category]} ({tags.length})
                                            </span>
                                            <span className="text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                                        </button>

                                        {isExpanded && (
                                            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                                                {tags.map((tag) => {
                                                    const isSelected = selectedTags.includes(tag.id);
                                                    const isDisabled = !isSelected && selectedTags.length >= maxTags;

                                                    return (
                                                        <button
                                                            key={tag.id}
                                                            type="button"
                                                            onClick={() => !isDisabled && toggleTag(tag.id)}
                                                            disabled={isDisabled}
                                                            className={`rounded-full px-2.5 py-1 text-xs transition ${isSelected
                                                                ? "bg-gray-900 text-white"
                                                                : isDisabled
                                                                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                                }`}
                                                            title={tag.name_en}
                                                        >
                                                            {tag.name_ru}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    ) : null}

                    {/* Footer с количеством */}
                    {selectedTags.length > 0 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                            <span className="text-xs text-gray-400">
                                Выбрано: {selectedTags.length}/{maxTags}
                            </span>
                            <button
                                type="button"
                                onClick={() => onTagsChange([])}
                                className="text-xs text-gray-500 hover:text-gray-700"
                            >
                                Очистить
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
